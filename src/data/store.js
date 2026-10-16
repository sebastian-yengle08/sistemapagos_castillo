// ─────────────────────────────────────────────────────────────────────────────
// Capa de datos de Pagos Castillo.
//
// Hoy guarda todo en localStorage. Las pantallas SOLO hablan con este archivo
// (nunca tocan localStorage), así que para pasar a Supabase basta con reemplazar
// `cargar()`/`guardar()` y el cuerpo de las funciones de abajo; la interfaz
// (nombres y parámetros) puede quedarse igual. Cada tabla de Supabase sería:
//   recibos, prestamos, historial.
// Nota: las funciones de Supabase son asíncronas; al migrar, cada función
// devolvería una Promesa y las pantallas harían `await`.
//
// REGLA DE HISTORIAL: toda función que modifica datos registra su entrada en el
// historial desde adentro (función `anotar`), para que no se pueda olvidar.
// ─────────────────────────────────────────────────────────────────────────────
import { crearDatosEjemplo } from './seed'
import { sumarMeses, partes } from '../utils/fechas'
import { PERFILES } from '../config/constantes'

const CLAVE = 'pagosCastillo.datos.v1'

// ── Estado en memoria + suscriptores (para que React se entere de los cambios) ──
let estado = cargar()
const oyentes = new Set()
let actor = null // 'asistente' | 'gerente' (quién hace los cambios)

function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (crudo) return JSON.parse(crudo)
  } catch {
    /* si el almacenamiento falla o está dañado, se cargan datos de ejemplo */
  }
  const inicial = crearDatosEjemplo()
  guardar(inicial)
  return inicial
}

function guardar(nuevo) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(nuevo))
  } catch {
    /* sin espacio o bloqueado: la app sigue funcionando en memoria */
  }
}

function publicar(nuevo) {
  estado = nuevo
  guardar(nuevo)
  oyentes.forEach((f) => f())
}

export const suscribir = (f) => {
  oyentes.add(f)
  return () => oyentes.delete(f)
}
export const obtenerEstado = () => estado

/** Define quién está usando el sistema (para el historial). */
export function definirActor(perfil) {
  actor = perfil
}

/** Agrega una entrada al historial y devuelve el nuevo arreglo. */
function anotar(historial, accion, texto, perfil = actor) {
  return [
    ...historial,
    {
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ts: new Date().toISOString(),
      perfil: PERFILES[perfil] ?? 'Asistente',
      accion,
      texto,
    },
  ]
}

const nuevoId = (est, prefijo) => ({ id: `${prefijo}_${est.seq + 1}`, seq: est.seq + 1 })
const normalizar = (t) => String(t ?? '').toLowerCase().replace(/\s+/g, '')

// ── Consultas ───────────────────────────────────────────────────────────────
export function obtenerRecibo(id) {
  return estado.recibos.find((r) => r.id === id) ?? null
}
export function obtenerPrestamo(id) {
  return estado.prestamos.find((p) => p.id === id) ?? null
}

/** Busca un recibo con la misma empresa y código (sin distinguir mayúsculas ni espacios). */
export function buscarDuplicado(empresa, codigo, ignorarId = null) {
  return (
    estado.recibos.find(
      (r) => r.id !== ignorarId && normalizar(r.empresa) === normalizar(empresa) && normalizar(r.codigo) === normalizar(codigo),
    ) ?? null
  )
}

/** Último medio de pago usado con una empresa (según pagos anteriores) o null. */
export function ultimoMedioDeEmpresa(empresa) {
  const pagos = estado.recibos
    .filter((r) => r.pago && normalizar(r.empresa) === normalizar(empresa))
    .sort((a, b) => (a.pago.fecha < b.pago.fecha ? 1 : a.pago.fecha > b.pago.fecha ? -1 : 0))
  return pagos[0]?.pago.medio ?? null
}

// ── Recibos ─────────────────────────────────────────────────────────────────
export function crearRecibo(datos) {
  const { id, seq } = nuevoId(estado, 'r')
  const recibo = {
    id,
    tipo: datos.tipo,
    empresa: datos.empresa.trim(),
    codigo: datos.codigo.trim(),
    fechaLimite: datos.fechaLimite,
    monto: datos.monto,
    igv: datos.igv ?? null,
    estado: 'Pendiente',
    pago: null,
    prestamoId: null,
    cuota: null,
    creadoEn: new Date().toISOString(),
  }
  publicar({
    ...estado,
    seq,
    recibos: [...estado.recibos, recibo],
    historial: anotar(estado.historial, 'crear', `Registró el recibo de ${recibo.empresa} (${recibo.tipo})`),
  })
  return recibo
}

const ETIQUETAS_CAMPO = { tipo: 'el tipo', empresa: 'la empresa', codigo: 'el código', fechaLimite: 'la fecha límite', monto: 'el monto', igv: 'el IGV' }

export function editarRecibo(id, cambios) {
  const actual = obtenerRecibo(id)
  if (!actual || actual.prestamoId) return null // las cuotas de préstamo no se editan
  const nuevo = { ...actual, ...cambios, empresa: (cambios.empresa ?? actual.empresa).trim(), codigo: (cambios.codigo ?? actual.codigo).trim() }
  const tocados = Object.keys(ETIQUETAS_CAMPO).filter((k) => (actual[k] ?? null) !== (nuevo[k] ?? null))
  const texto = tocados.length === 1
    ? `Editó ${ETIQUETAS_CAMPO[tocados[0]]} del recibo de ${nuevo.empresa}`
    : `Editó el recibo de ${nuevo.empresa}`
  publicar({
    ...estado,
    recibos: estado.recibos.map((r) => (r.id === id ? nuevo : r)),
    historial: anotar(estado.historial, 'editar', texto),
  })
  return nuevo
}

export function eliminarRecibo(id) {
  const actual = obtenerRecibo(id)
  if (!actual || actual.prestamoId) return false
  publicar({
    ...estado,
    recibos: estado.recibos.filter((r) => r.id !== id),
    historial: anotar(estado.historial, 'eliminar', `Eliminó el recibo de ${actual.empresa} (${actual.codigo})`),
  })
  return true
}

/** Registra el pago de un recibo. datos: { monto, fecha, medio, comprobante } */
export function registrarPago(id, datos) {
  const actual = obtenerRecibo(id)
  if (!actual || actual.estado === 'Pagado') return null
  const pagado = {
    ...actual,
    estado: 'Pagado',
    pago: { monto: datos.monto, fecha: datos.fecha, medio: datos.medio, comprobante: (datos.comprobante ?? '').trim() },
  }
  publicar({
    ...estado,
    recibos: estado.recibos.map((r) => (r.id === id ? pagado : r)),
    historial: anotar(estado.historial, 'pago', `Registró el pago del recibo de ${actual.empresa}`),
  })
  return pagado
}

// ── Préstamos ───────────────────────────────────────────────────────────────
/** Lista de cuotas que se crearían (se usa en la vista previa y al guardar). */
export function calcularCuotas({ numCuotas, montoCuota, primeraFecha }) {
  const dia = partes(primeraFecha).d
  return Array.from({ length: numCuotas }, (_, i) => ({
    numero: i + 1,
    fechaLimite: sumarMeses(primeraFecha, i, dia), // mismo día cada mes; si no existe, último día del mes
    monto: montoCuota,
  }))
}

/** datos: { entidad, montoTotal, numCuotas, montoCuota, primeraFecha } */
export function crearPrestamo(datos) {
  const idp = nuevoId(estado, 'p')
  let seq = idp.seq
  const correlativo = estado.prestamos.length + 1
  const codigoBase = `PRE-${String(correlativo).padStart(4, '0')}`
  const prestamo = {
    id: idp.id,
    entidad: datos.entidad.trim(),
    montoTotal: datos.montoTotal,
    numCuotas: datos.numCuotas,
    montoCuota: datos.montoCuota,
    primeraFecha: datos.primeraFecha,
    correlativo,
    creadoEn: new Date().toISOString(),
  }
  const cuotas = calcularCuotas(datos).map((c) => {
    seq += 1
    return {
      id: `r_${seq}`,
      tipo: 'Préstamo',
      empresa: prestamo.entidad,
      codigo: `${codigoBase}-C${c.numero}/${datos.numCuotas}`,
      fechaLimite: c.fechaLimite,
      monto: c.monto,
      igv: null,
      estado: 'Pendiente',
      pago: null,
      prestamoId: prestamo.id,
      cuota: c.numero,
      creadoEn: prestamo.creadoEn,
    }
  })
  publicar({
    ...estado,
    seq,
    prestamos: [...estado.prestamos, prestamo],
    recibos: [...estado.recibos, ...cuotas],
    historial: anotar(estado.historial, 'prestamo', `Registró el préstamo de ${prestamo.entidad}`),
  })
  return prestamo
}

/** Resumen de un préstamo: cuotas, pagadas, saldo pendiente y próximo vencimiento. */
export function resumenPrestamo(prestamo, recibos = estado.recibos) {
  const cuotas = recibos.filter((r) => r.prestamoId === prestamo.id).sort((a, b) => a.cuota - b.cuota)
  const pagadas = cuotas.filter((c) => c.estado === 'Pagado')
  const pendientes = cuotas.filter((c) => c.estado !== 'Pagado')
  return {
    cuotas,
    pagadas: pagadas.length,
    total: cuotas.length,
    saldo: pendientes.reduce((s, c) => s + c.monto, 0),
    proximo: pendientes[0]?.fechaLimite ?? null,
  }
}

// ── Ingreso y pruebas ───────────────────────────────────────────────────────
/** Registra "Ingresó al sistema" con el perfil que entró. */
export function registrarIngreso(perfil) {
  definirActor(perfil)
  publicar({ ...estado, historial: anotar(estado.historial, 'ingreso', 'Ingresó al sistema', perfil) })
}

/** Solo para pruebas: vuelve a cargar los datos de ejemplo (y reinicia el historial). */
export function reiniciarDatos() {
  publicar(crearDatosEjemplo())
}
