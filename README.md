# Pagos Castillo — Prototipo funcional (Sprint 1)

Sistema para **ordenar, registrar y visualizar** los pagos de la empresa Castillo. El gerente entrega los recibos en físico, el asistente los registra y, después de pagar por su cuenta, registra el pago. **El sistema no paga nada.**

React + Vite + Tailwind CSS (JavaScript). Los datos viven en Supabase (con respaldo en `localStorage` si no hay conexión configurada), detrás de una capa separada (`src/data/store.js`). Las fotos de los vouchers se guardan en Supabase Storage (bucket `vouchers`).

## Instalar y ejecutar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # compilación de producción en /dist
```

## PIN de prueba

El PIN identifica a la persona (no hay selección de perfil).

| Perfil    | PIN    | Pantallas                                            |
|-----------|--------|------------------------------------------------------|
| Asistente | `1234` | Calendario, Avisos, Nuevo recibo, Registrar pago, Editar/Eliminar |
| Gerente   | `4321` | Calendario, Avisos, Préstamos, Historial (solo consulta de recibos) |

Los PIN están en `src/config/pins.js` como hash SHA-256 (`SHA-256("pagos-castillo:" + PIN)`), nunca en texto plano. En la pantalla de PIN hay un enlace discreto **"Restablecer datos de ejemplo"** (solo para pruebas; también reinicia el historial).

## Estructura

```
src/
  config/      pins.js (hashes), constantes.js (tipos, medios, zona horaria)
  data/        store.js (TODA la lógica de datos + historial), seed.js (datos de ejemplo), useDatos.js
  utils/       fechas.js (fechas locales de Lima), dinero.js (S/ 1,250.00), estado.js, avisos.js, hash.js
  context/     AuthContext.jsx (sesión en sessionStorage)
  components/  ui.jsx (botones, chips, insignias, ventanas), Layout.jsx, ReciboFila.jsx, RegistrarPagoModal.jsx
  pages/       PinPage, CalendarioPage, AvisosPage, ReciboFormPage, ReciboDetallePage,
               PrestamosPage, PrestamoNuevoPage, PrestamoDetallePage, HistorialPage
```

### Modelo de datos

- **recibo**: `id, tipo, empresa, codigo, fechaLimite (aaaa-mm-dd), monto, igv, estado (Pendiente|Pagado), pago {monto, interes, fecha, medio, foto, fotoPath}, prestamoId, cuota, creadoEn`. *Vencido* no se guarda: se calcula al mostrar.
- **prestamo**: `id, entidad, montoTotal, numCuotas, montoCuota, primeraFecha, correlativo`.
- **historial**: `id, ts (instante UTC), perfil, accion, texto`. Cada función de `store.js` que modifica datos lo registra internamente.

### Pasar a Supabase y desplegar en Vercel

- Tablas sugeridas: `recibos`, `prestamos`, `historial` (mismos campos de arriba).
- Hay que reemplazar solo `src/data/store.js` (las pantallas no tocan `localStorage`). Las funciones pasarían a ser asíncronas (`await`).
- Las claves de Supabase irían en variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Vercel.
- `vercel.json` ya incluye la reescritura para que las rutas del navegador funcionen. Configurar el proyecto de Vercel con **Root Directory = `pagos-castillo`**.
- Importante: al conectar Supabase hay que reemplazar el PIN en el navegador por autenticación real (un hash visible en el código del cliente no es seguridad de verdad).

## Voucher (foto del comprobante)

Al registrar o corregir un pago, el asistente **debe subir la foto del voucher** ("Tomar foto" en celular o "Elegir imagen"). La foto se reduce a JPEG (máx. 1600 px) antes de subirla, se guarda en Supabase Storage y se ve en el detalle del recibo pagado, tanto para el asistente como para el gerente. Al anular el pago, la foto se borra. Para crear el bucket hay que ejecutar `supabase/schema.sql` en Supabase.

## Guion de demo (3 minutos)

**Asistente (PIN 1234)**
1. *Calendario*: mostrar contadores del mes (solo cantidades) y "Próximos pagos". Tocar un día → panel con "Ver detalle".
2. *Avisos* (campana con contador): Vence hoy, Vence en 3 días, Vencidos.
3. *Nuevo recibo*: dejar vacío y guardar (mensajes claros); luego llenar SEDALIB + código ya existente → aparece **"Este recibo parece repetido"** → Cancelar.
4. Abrir el recibo de SEDALIB que vence hoy → **Registrar pago** (toque 1) → ya viene con monto, fecha y *Efectivo — Usado la última vez* → **sube la foto del voucher** → **Confirmar pago** → "Pago registrado" ✔. Ver "Pago realizado" en el detalle, el recibo en verde y el contador de Pagados +1.
5. Editar y eliminar un recibo (con confirmación). Mostrar que una cuota de préstamo solo se puede pagar.
6. **Bloquear**.

**Gerente (PIN 4321)**
1. Calendario y Avisos (misma información, sin botones de edición).
2. *Préstamos*: tarjetas con progreso ("3 de 6"), saldo y próximo vencimiento. **Nuevo préstamo** → llenar datos → vista previa de cuotas (mismo día cada mes) → Guardar.
3. Detalle del préstamo con tabla de cuotas; las cuotas ya están en el calendario.
4. *Historial*: ingreso, registro del recibo, pago y préstamo, agrupado por día.

## Pendiente para la siguiente etapa

Pago automático desde el sistema · notificaciones push · historial mensual · totales de gasto por categoría · impuestos con recurrencia · restricciones al gerente · usuarios individuales con login · backend real (Supabase) · registro de tarjetas · tests automatizados · bucket de vouchers privado con acceso por usuario.
