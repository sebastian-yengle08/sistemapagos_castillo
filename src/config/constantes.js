// Constantes de negocio compartidas por toda la aplicación.
export const TIPOS = ['Servicio', 'Proveedor', 'Impuesto', 'Préstamo']
export const MEDIOS = ['Visa', 'Mastercard', 'American Express', 'Yape', 'Plin', 'Transferencia', 'Efectivo']
export const PERFILES = { asistente: 'Asistente', gerente: 'Gerente' }
export const ZONA = 'America/Lima'
// Todos los montos se guardan en columnas numeric(12,2) de Supabase: máximo 10 dígitos enteros y 2 decimales.
// Si se supera, la base rechaza el guardado, por eso los topes de la app son exactamente ese máximo.
export const LIMITE_MONTO = 9999999999.99 // Monto de un recibo
export const LIMITE_PRESTAMO = 9999999999.99 // Monto total de un préstamo (suma de sus cuotas)
export const LIMITE_CUOTA = 9999999999.99 // Monto de cuota: hasta 10 dígitos enteros (numeric(12,2))
export const MAX_CUOTAS = 120 // Número máximo de cuotas de un préstamo
