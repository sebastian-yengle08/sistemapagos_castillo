// Validaciones de escritura reutilizables para los campos de la app.

/** Solo letras (con tildes, ñ, ü), espacios y signos comunes en nombres de empresas. Sin números. */
export function soloLetras(texto) {
  return String(texto ?? '').replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'&()-]/g, '')
}

/** Solo letras, números y espacios (para razón social o RUC). */
export function soloLetrasNumeros(texto) {
  return String(texto ?? '')
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
    .replace(/\s+/g, ' ')
}

/** Solo números y punto decimal para montos (el prefijo S/ ya se muestra aparte). */
export function soloMonto(texto) {
  let v = String(texto ?? '').replace(/[^0-9.]/g, '')
  // Un solo punto decimal
  const partes = v.split('.')
  if (partes.length > 2) v = partes[0] + '.' + partes.slice(1).join('')
  return v
}

/** Monto de cuota: hasta 10 dígitos enteros y 2 decimales (numeric(12,2)). */
export function soloMontoCuota(texto) {
  const v = String(texto ?? '').replace(/[^0-9.]/g, '')
  const partes = v.split('.')
  const entera = partes[0].slice(0, 10)
  if (partes.length === 1) return entera
  return `${entera}.${partes.slice(1).join('').slice(0, 2)}`
}

/** Solo letras, números y signos comunes en códigos de comprobante: - _ / . y espacio. */
export function soloCodigo(texto) {
  return String(texto ?? '').replace(/[^a-zA-Z0-9\-_/. ]/g, '')
}

/** Solo dígitos (código de recibo de Servicio o Impuesto). */
export function soloDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '')
}

/** Solo letras, números y guion medio (código de recibo de Proveedor). */
export function soloCodigoProveedor(texto) {
  return String(texto ?? '').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ-]/g, '')
}
