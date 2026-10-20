// Constantes de negocio compartidas por toda la aplicación.
export const TIPOS = ['Servicio', 'Proveedor', 'Impuesto', 'Préstamo']
export const MEDIOS = ['Visa', 'Mastercard', 'American Express', 'Yape', 'Plin', 'Transferencia', 'Efectivo']
export const PERFILES = { asistente: 'Asistente', gerente: 'Gerente' }
export const ZONA = 'America/Lima'
export const LIMITE_PRESTAMO = 100000000000 // Límite máximo del monto total del préstamo: S/ 100.000.000.000
export const LIMITE_CUOTA = 9999999999.99 // Monto de cuota: hasta 10 dígitos enteros (numeric(12,2))
export const MAX_CUOTAS = 120 // Número máximo de cuotas de un préstamo
