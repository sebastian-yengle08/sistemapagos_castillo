# Pagos Castillo — Prototipo funcional (Sprint 1)

Sistema para **ordenar, registrar y visualizar** los pagos de la empresa Castillo. El gerente entrega los recibos en físico, el asistente los registra y, después de pagar por su cuenta, registra el pago con la **foto del voucher**. **El sistema no paga nada.**

React + Vite + Tailwind CSS (JavaScript). Los datos viven en Supabase (con respaldo en `localStorage` si no hay conexión configurada), detrás de una capa separada (`src/data/store.js`). Las fotos de los vouchers se guardan en Supabase Storage (bucket `vouchers`). Todos los dispositivos se mantienen sincronizados (Realtime + lectura cada 5 segundos).

## Instalar y ejecutar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # compilación de producción en /dist
```

Variables de entorno (`.env.local`, ver `.env.example`): `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## PIN de prueba

El PIN identifica a la persona (no hay selección de perfil).

| Perfil    | PIN    | Qué puede hacer |
|-----------|--------|-----------------|
| Asistente | `1234` | Calendario, Avisos, Nuevo recibo, Registrar y corregir pagos, Editar/Eliminar recibos pendientes, **crear y editar préstamos** |
| Gerente   | `4321` | Calendario, Avisos, Préstamos (solo consulta) e Historial |

Los PIN están en `src/config/pins.js` como hash SHA-256 (`SHA-256("pagos-castillo:" + PIN)`), nunca en texto plano. El botón **Cerrar sesión** (o **Salir** en celular) vuelve a la pantalla de PIN.

## Estructura

```
src/
  config/      pins.js (hashes), constantes.js (tipos, medios, zona horaria, topes de monto)
  data/        store.js (TODA la lógica de datos, reglas e historial), persistencia.js (Supabase),
               seed.js (datos de ejemplo para una base vacía), useDatos.js
  utils/       fechas.js (fechas locales de Lima), dinero.js (S/ 1,250.00), estado.js, avisos.js,
               validacion.js (formatos de código y texto), prestamos.js (mora/interés), imagen.js (fotos),
               actualizacion.js (recarga si hay versión nueva), hash.js
  context/     AuthContext.jsx (sesión en sessionStorage)
  components/  ui.jsx, Layout.jsx, ReciboFila.jsx, RegistrarPagoModal.jsx, AvisoError.jsx
  pages/       PinPage, CalendarioPage, AvisosPage, ReciboFormPage, ReciboDetallePage,
               PrestamosPage, PrestamoFormPage, PrestamoDetallePage, HistorialPage
supabase/schema.sql   tablas, índice único del código de recibo, Realtime y bucket de fotos
```

### Modelo de datos

- **recibo**: `id, tipo, empresa, codigo, fechaLimite (aaaa-mm-dd), monto, igv, estado (Pendiente|Pagado), pago {monto, interes, fecha, medio, foto, fotoPath}, prestamoId, cuota, creadoEn`. *Vencido* no se guarda: se calcula al mostrar.
- **prestamo**: `id, entidad, montoTotal, numCuotas, montoCuota, primeraFecha, correlativo`.
- **historial**: `id, ts (instante UTC), perfil, accion, texto`. Cada función de `store.js` que modifica datos lo registra internamente.

## Reglas de negocio

- **Fechas**: desde el 1 de enero de 2026, siempre fechas reales y en hora de Lima. La fecha límite de un recibo nuevo (Servicio, Proveedor o Impuesto) debe estar dentro del mes actual, desde el día 1 hasta el último día; al editar un recibo antiguo se puede conservar su fecha. Los préstamos y sus cuotas pueden llegar hasta 24 años después de hoy. La fecha de pago no puede ser futura.
- **Montos**: máximo 10 dígitos enteros y 2 decimales (coincide con `numeric(12,2)` de Supabase). El monto total de un préstamo es la suma de sus cuotas.
- **Códigos de recibo**: Servicio = 8 a 13 dígitos; Impuesto = 4 dígitos; Proveedor = 10 caracteres alfanuméricos. Los códigos `PRE-...` de las cuotas de préstamo son internos.
- **Código único**: el código de cada recibo (voucher) es único y no se puede registrar dos veces, aunque cambie la empresa, el tipo o el mes. En *Nuevo recibo* los campos empiezan vacíos (solo la fecha sugiere hoy): no se autorrellenan empresas ni códigos de recibos anteriores.
- **Recibo repetido**: al guardar se avisa si el código ya existe y no se permite guardarlo. Los recibos antiguos que ya tenían códigos repetidos se pueden seguir editando sin cambiar el código.
- **Nombres** (empresa, entidad, banco): de 3 a 60 caracteres, un solo espacio entre palabras; al comparar no importan mayúsculas, espacios ni tildes. En Proveedor, cualquier número largo escrito en "Razón Social / RUC" se valida como RUC (11 dígitos y dígito verificador).
- **Tipo de recibo**: no se puede cambiar al editar (cada tipo tiene su formato de código).
- **Avisos antes de guardar** (se pueden aceptar con "Guardar igual"): fecha límite ya pasada. No se compara el monto con los recibos anteriores.
- **Pagos**: el monto pagado es el monto del recibo; en las cuotas de préstamo se puede sumar mora/interés. La mora no puede superar el monto de la cuota. La foto del voucher es obligatoria (hasta 25 MB, al menos 200 px de lado) y no puede ser la misma foto de otro pago ni la que ya tiene ese pago al corregirlo. Un pago se **puede corregir** (fecha, medio y foto) pero **no anular**; un recibo pagado no se edita ni se elimina.
- **Préstamos**: los crea y edita el asistente. La fecha de una cuota pendiente no puede ser anterior a hoy: al crear, la primera cuota vence hoy o después; al editar, si cambias la fecha también debe ser hoy o después (una cuota ya vencida conserva su fecha mientras no la cambies). Cada cuota se crea como un recibo Pendiente de tipo Préstamo. Al editar, el número de cuotas no se puede cambiar; la fecha editable es la de la primera cuota pendiente (si la primera ya se pagó, se muestra la cuota 2 o la que siga) y desde ahí se reprograman las pendientes. Si ya hay cuotas pagadas, el monto de cada cuota queda bloqueado, las cuotas pagadas no cambian y las pendientes no pueden vencer antes que ellas. No se puede registrar dos veces el mismo préstamo (mismo banco, cuotas, monto y primera fecha).

- **Sesión y PIN**: tras 5 PIN incorrectos el teclado se bloquea 30 segundos (el doble en cada nuevo bloqueo) y la sesión se cierra sola tras 15 minutos sin usar la app. El almacén de datos también comprueba el perfil: solo el asistente registra o modifica datos.
- **Varios dispositivos**: cada fila de recibos y préstamos tiene una `version` (la sube la base sola). Si otro dispositivo cambió la misma fila a la vez, el cambio local no se guarda, se muestra lo último y se avisa. La lectura es por páginas (sin límite de filas) y la hora del historial la pone el servidor.

## Voucher (foto del comprobante)

Al registrar o corregir un pago, el asistente **debe subir la foto del voucher** ("Tomar foto" en celular o "Elegir imagen"). La foto se reduce a JPEG (máx. 1600 px) antes de subirla, se guarda en Supabase Storage y se ve en el detalle del recibo pagado, tanto para el asistente como para el gerente. Si se cambia la foto, la anterior se borra; si el pago no llega a guardarse, la foto recién subida también se borra.

## Supabase y Vercel

- Ejecutar `supabase/schema.sql` en el SQL Editor de Supabase (se puede repetir): crea las tablas, los índices únicos, el control de versiones, el Realtime y el bucket `vouchers`.
- En Vercel, configurar el proyecto con **Root Directory = `pagos-castillo`** y las dos variables `VITE_SUPABASE_*`. `vercel.json` ya incluye la reescritura de rutas.
- **Seguridad (importante antes de usar datos reales):** el acceso con la clave pública queda abierto (las políticas permiten todo al rol `anon`), el PIN se valida en el navegador y el bucket de fotos es público con nombres aleatorios. Hay que reemplazarlo por autenticación de Supabase con políticas por usuario y un bucket privado.

## Guion de demo (3 minutos)

**Asistente (PIN 1234)**
1. *Calendario*: contadores del mes (solo cantidades) y **Pagos del mes** con filtro Todos/Pagados/Pendientes/Vencidos. Tocar un día → panel con "Ver detalle".
2. *Avisos*: Vence hoy, Vence en 3 días, Vencidos.
3. *Nuevo recibo*: dejar vacío y guardar (mensajes claros); escribir un código que ya existe → **"Este código ya está registrado"**.
4. Abrir un recibo pendiente → **Registrar pago** → ya viene el monto, la fecha y el medio usado la última vez → **sube la foto del voucher** → **Confirmar pago** ✔. Ver "Pago realizado", la foto, el recibo en verde y el contador de Pagados +1.
5. Editar y eliminar un recibo pendiente (con confirmación). Mostrar que un recibo pagado solo permite **Corregir pago**.
6. *Préstamos*: **Nuevo préstamo** → número de cuotas y monto → el total se calcula solo → vista previa → Guardar. Pagar una cuota con mora/interés.
7. **Cerrar sesión**.

**Gerente (PIN 4321)**
1. Calendario y Avisos (misma información, sin botones de edición).
2. *Préstamos*: tarjetas con progreso, saldo y próximo vencimiento; detalle con tabla de cuotas, interés y total pagado (solo consulta).
3. *Historial*: registro, pago, corrección y préstamo, agrupado por día.

## Pendiente para la siguiente etapa

Pago automático desde el sistema · notificaciones push · historial de inicios de sesión · historial mensual · totales de gasto por categoría · impuestos con recurrencia · usuarios individuales con login (y seguridad real en Supabase) · registro de tarjetas · tests automatizados.
