-- Pagos Castillo: tablas para Supabase.
-- Pégalo completo en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.

create table if not exists public.prestamos (
  id            text primary key,
  entidad       text not null,
  monto_total   numeric(12,2) not null,
  num_cuotas    integer not null,
  monto_cuota   numeric(12,2) not null,
  primera_fecha date not null,
  correlativo   integer not null,
  creado_en     timestamptz not null default now()
);

create table if not exists public.recibos (
  id            text primary key,
  tipo          text not null check (tipo in ('Servicio','Proveedor','Impuesto','Préstamo')),
  empresa       text not null,
  codigo        text not null,
  fecha_limite  date not null,
  monto         numeric(12,2) not null,
  igv           numeric(12,2),
  estado        text not null check (estado in ('Pendiente','Pagado')),
  pago          jsonb,                      -- {monto, interes, fecha, medio, foto, fotoPath}
  prestamo_id   text references public.prestamos(id) on delete cascade,
  cuota         integer,
  creado_en     timestamptz not null default now()
);
create index if not exists recibos_fecha_idx on public.recibos (fecha_limite);

create table if not exists public.historial (
  id      text primary key,
  ts      timestamptz not null default now(),
  perfil  text not null check (perfil in ('Asistente','Gerente')),
  accion  text not null,
  texto   text not null
);
create index if not exists historial_ts_idx on public.historial (ts desc);

-- Seguridad por filas (RLS).
-- OJO: en este prototipo el acceso con la clave publishable queda ABIERTO
-- (el PIN se valida en el navegador). Antes de usar datos reales hay que
-- reemplazarlo por autenticación de Supabase y políticas por usuario.
alter table public.prestamos enable row level security;
alter table public.recibos   enable row level security;
alter table public.historial enable row level security;

drop policy if exists "prototipo prestamos" on public.prestamos;
drop policy if exists "prototipo recibos"   on public.recibos;
drop policy if exists "prototipo historial" on public.historial;
create policy "prototipo prestamos" on public.prestamos for all to anon using (true) with check (true);
create policy "prototipo recibos"   on public.recibos   for all to anon using (true) with check (true);
create policy "prototipo historial" on public.historial for all to anon using (true) with check (true);

-- Tiempo real: los cambios se ven al instante en todos los dispositivos.
-- (Si no se ejecuta, la app igual se actualiza sola cada 10 segundos.)
do $$
declare t text;
begin
  foreach t in array array['recibos','prestamos','historial'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Fotos de los vouchers (comprobantes de pago).
-- Bucket público (las fotos se ven con un enlace con nombre aleatorio); máx. 5 MB por foto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vouchers', 'vouchers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "prototipo vouchers ver"   on storage.objects;
drop policy if exists "prototipo vouchers subir" on storage.objects;
drop policy if exists "prototipo vouchers borrar" on storage.objects;
create policy "prototipo vouchers ver"    on storage.objects for select to anon using (bucket_id = 'vouchers');
create policy "prototipo vouchers subir"  on storage.objects for insert to anon with check (bucket_id = 'vouchers');
create policy "prototipo vouchers borrar" on storage.objects for delete to anon using (bucket_id = 'vouchers');

-- Limpieza: las notificaciones se quitaron de la app.
drop table if exists public.suscripciones;

-- Respaldo adicional: el código de un recibo es único en todo el sistema (sin importar empresa,
-- tipo ni mes), ni siquiera desde dos dispositivos a la vez. (No aplica a las cuotas de préstamo.)
-- Si ya hay códigos repetidos de antes, este índice no se crea: primero hay que corregirlos.
drop index if exists public.recibos_unico_idx;
create unique index if not exists recibos_codigo_unico_idx
  on public.recibos (lower(replace(codigo, ' ', '')))
  where prestamo_id is null;

-- El número de préstamo (PRE-0001, PRE-0002...) no se repite.
create unique index if not exists prestamos_correlativo_idx on public.prestamos (correlativo);

-- Control de versiones: evita que un dispositivo con datos viejos pise el trabajo de otro
-- (por ejemplo, volver a dejar Pendiente un recibo que otro acaba de pagar).
-- La base sube `version` sola en cada cambio; la app solo guarda si la fila sigue en la versión que vio.
alter table public.recibos   add column if not exists version integer not null default 0;
alter table public.prestamos add column if not exists version integer not null default 0;

create or replace function public.sumar_version() returns trigger
language plpgsql as $$
begin
  new.version := old.version + 1;
  return new;
end $$;

drop trigger if exists recibos_version   on public.recibos;
drop trigger if exists prestamos_version on public.prestamos;
create trigger recibos_version   before update on public.recibos   for each row execute function public.sumar_version();
create trigger prestamos_version before update on public.prestamos for each row execute function public.sumar_version();

-- Limpieza: el bloqueo de pagos del gerente (por recibo y general) se quitó de la app.
drop trigger if exists recibos_bloqueo_pagos on public.recibos;
drop function if exists public.impedir_pago_bloqueado();
alter table public.recibos drop column if exists bloqueado;
drop table if exists public.ajustes;
