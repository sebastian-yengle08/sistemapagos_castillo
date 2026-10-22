// Validaciones de escritura reutilizables para los campos de la app.
import { CODIGO_MAX } from '../config/constantes'

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

/**
 * Formato del código de un recibo (igual para todos los tipos): hasta CODIGO_MAX caracteres,
 * con al menos una letra o un número y solo letras, números y - _ / . (y espacio).
 */
export function codigoValido(codigo) {
  const c = String(codigo ?? '').trim()
  return c.length >= 1 && c.length <= CODIGO_MAX && /[a-zA-Z0-9]/.test(c) && /^[a-zA-Z0-9\-_/. ]+$/.test(c)
}

/** Quita las tildes (para comparar "Telefónica" con "Telefonica"). */
export function sinTildes(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Un solo espacio entre palabras y sin espacios al inicio ni al final. */
export function limpiarNombre(texto) {
  return String(texto ?? '').replace(/\s+/g, ' ').trim()
}

/** RUC peruano: 11 dígitos, empieza con 10, 15, 16, 17 o 20 y el último dígito es el verificador (módulo 11). */
export function rucValido(ruc) {
  if (!/^\d{11}$/.test(ruc)) return false
  if (!['10', '15', '16', '17', '20'].includes(ruc.slice(0, 2))) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((t, p, i) => t + p * Number(ruc[i]), 0)
  let verificador = 11 - (suma % 11)
  if (verificador >= 10) verificador -= 10
  return verificador === Number(ruc[10])
}

/**
 * Revisa el RUC escrito dentro de "Razón Social / RUC": cualquier número largo (8 dígitos o más)
 * se toma como un RUC y debe tener 11 dígitos y un dígito verificador correcto.
 * Devuelve el mensaje de error o null.
 */
export function errorDeRuc(texto) {
  for (const numero of String(texto ?? '').match(/\d{8,}/g) ?? []) {
    if (numero.length !== 11) return 'El RUC debe tener exactamente 11 dígitos.'
    if (!rucValido(numero)) return 'El RUC no es válido: revisa los dígitos (el último es un dígito verificador).'
  }
  return null
}
