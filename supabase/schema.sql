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
  pago          jsonb,                      -- {monto, fecha, medio, comprobante}
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

-- Dispositivos que activaron las notificaciones (una fila por navegador/celular)
create table if not exists public.suscripciones (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  perfil     text not null,
  creado_en  timestamptz not null default now()
);
alter table public.suscripciones enable row level security;
drop policy if exists "prototipo suscripciones" on public.suscripciones;
create policy "prototipo suscripciones" on public.suscripciones for all to anon using (true) with check (true);
