// Fechas como texto "aaaa-mm-dd" tratadas como fecha LOCAL (Lima). Nunca se usa
// new Date("aaaa-mm-dd") porque eso interpreta UTC y puede correr un día.
import { ZONA } from '../config/constantes.js'

const pad = (n) => String(n).padStart(2, '0')

/** Hoy en Lima, como "aaaa-mm-dd". */
export function hoyISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** Rango permitido para las fechas de la app. */
export const FECHA_MINIMA = '2026-01-01'
export const FECHA_MAXIMA = '2050-12-31'

export function partes(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  return { a, m, d }
}

export function armar(a, m, d) {
  return `${a}-${pad(m)}-${pad(d)}`
}

/** Días del mes (m = 1..12). */
export function diasDelMes(a, m) {
  return new Date(Date.UTC(a, m, 0)).getUTCDate()
}

/** Suma (o resta) días a una fecha ISO. */
export function sumarDias(iso, n) {
  const { a, m, d } = partes(iso)
  const f = new Date(Date.UTC(a, m - 1, d + n))
  return armar(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate())
}

/** Diferencia en días: b - a. */
export function diasEntre(aISO, bISO) {
  const x = partes(aISO)
  const y = partes(bISO)
  return Math.round((Date.UTC(y.a, y.m - 1, y.d) - Date.UTC(x.a, x.m - 1, x.d)) / 86400000)
}

/** Suma meses; si el mes no tiene ese día usa el último día del mes. */
export function sumarMeses(iso, n, diaOriginal) {
  const { a, m, d } = partes(iso)
  const total = a * 12 + (m - 1) + n
  const na = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const dia = Math.min(diaOriginal ?? d, diasDelMes(na, nm))
  return armar(na, nm, dia)
}

/** dd/mm/aaaa */
export function formatoFecha(iso) {
  if (!iso) return ''
  const { a, m, d } = partes(iso)
  return `${pad(d)}/${pad(m)}/${a}`
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const nombreMes = (m) => MESES[m - 1]
export function nombreDia(iso) {
  const { a, m, d } = partes(iso)
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
}
/** "15 de Mayo de 2025" */
export function fechaLarga(iso) {
  const { a, m, d } = partes(iso)
  return `${d} de ${nombreMes(m)} de ${a}`
}

/** Día de la semana con lunes = 0 */
export function diaSemanaLunes(a, m, d) {
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7
}

/** Fecha (aaaa-mm-dd) en Lima de un instante ISO (UTC) del historial. */
export function fechaLimaDeInstante(instante) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instante))
}
/** Hora en Lima, por ejemplo "03:45 p. m." */
export function horaLima(instante) {
  return new Intl.DateTimeFormat('es-PE', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(instante))
}
