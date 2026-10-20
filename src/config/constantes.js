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

// Reglas de validación compartidas
export const NOMBRE_MIN = 3 // Largo mínimo del nombre de una empresa, entidad o banco
export const NOMBRE_MAX = 60 // Largo máximo
export const ANIOS_MAXIMOS = 24 // Las fechas pueden llegar hasta 24 años después de hoy (el límite se mueve con el calendario)
export const MAX_ARCHIVO_MB = 25 // Peso máximo de una foto antes de reducirla
export const MIN_LADO_FOTO = 200 // Lado menor mínimo (en píxeles) de una foto de voucher
export const MAX_INTENTOS_PIN = 5 // Intentos fallidos de PIN antes de bloquear
export const BLOQUEO_PIN_SEG = 30 // Segundos de bloqueo (se duplica en cada nuevo bloqueo)
export const INACTIVIDAD_MIN = 15 // Minutos sin usar la app para cerrar la sesión
