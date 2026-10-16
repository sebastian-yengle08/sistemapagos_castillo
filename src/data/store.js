// ─────────────────────────────────────────────────────────────────────────────
// Capa de datos de Pagos Castillo.
//
// Las pantallas SOLO hablan con este archivo. Los datos viven en memoria (rápido
// para la pantalla) y se guardan en Supabase (ver persistencia.js) o, si no hay
// variables VITE_SUPABASE_*, en localStorage. Cada cambio se muestra al instante
// y se envía a Supabase en segundo plano, en orden (cola).
//
// REGLA DE HISTORIAL: toda función que modifica datos registra su entrada en el
// historial desde adentro (función `anotar`), para que no se pueda olvidar.
// ─────────────────────────────────────────────────────────────────────────────
import { crearDatosEjemplo } from './seed'
import { hayNube, leerNube, sincronizarNube } from './persistencia'
import { sumarMeses, partes } from '../utils/fechas'
import { PERFILES } from '../config/constantes'

const CLAVE = 'pagosCastillo.datos.v1'

// ── Estado en memoria + suscriptores (para que React se entere de los cambios) ──
let estado = { seq: 0, recibos: [], prestamos: [], historial: [] }
const oyentes = new Set()
let actor = null // 'asistente' | 'gerente' (quién hace los cambios)
let usaNube = hayNube
let cola = Promise.resolve() // los envíos a Supabase salen de uno en uno y en orden

function avisarError(mensaje) {
  console.error('[Pagos Castillo]', mensaje)
  window.dispatchEvent(new CustomEvent('pagos:error', { detail: mensaje }))
}
const notificar = () => oyentes.forEach((f) => f())

function leerLocal() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (crudo) return JSON.parse(crudo)
  } catch {
    /* almacenamiento dañado o bloqueado: se usan datos de ejemplo */
  }
  return null
}
function guardarLocal(datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos))
  } catch {
    /* sin espacio o bloqueado: la app sigue funcionando en memoria */
  }
}

/** Carga los datos al abrir la app (desde Supabase o localStorage). Llamar una vez. */
export async function iniciarDatos() {
  if (usaNube) {
    try {
      const d = await leerNube()
      if (d.recibos.length + d.prestamos.length + d.historial.length === 0) {
        // Base vacía: primer arranque, se cargan los datos de ejemplo
        const ejemplo = crearDatosEjemplo()
        estado = { seq: 0, recibos: [], prestamos: [], historial: [] }
        publicar(ejemplo)
      } else {
        estado = { seq: 0, ...d }
      }
      return
    } catch (e) {
      usaNube = false // no se pudo conectar: se sigue con localStorage
      avisarError(`No se pudo conectar con Supabase (${e.message}). Se usan datos locales.`)
    }
  }
  estado = leerLocal() ?? crearDatosEjemplo()
  guardarLocal(estado)
}

/** Vuelve a leer Supabase (por si otra persona hizo cambios). Espera a los envíos pendientes. */
export function refrescar() {
  if (!usaNube) return
  cola = cola.then(async () => {
    try {
      estado = { ...estado, ...(await leerNube()) }
      notificar()
    } catch {
      /* sin conexión: se mantiene lo que ya se ve */
    }
  })
}

function publicar(nuevo) {
  const previo = estado
  estado = nuevo
  if (usaNube) {
    cola = cola
      .then(() => sincronizarNube(previo, nuevo))
      .catch((e) => avisarError(`No se pudo guardar en Supabase: ${e.message}`))
  } else {
    guardarLocal(nuevo)
  }
  notificar()
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

const nuevoId = (prefijo) => `${prefijo}_${crypto.randomUUID().slice(0, 12)}`
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
  const id = nuevoId('r')
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
    recibos: [...estado.recibos, recibo],
    historial: anotar(estado.historial, 'crear', `Registró el recibo de ${recibo.empresa} (${recibo.tipo})`),
  })
  return recibo
}

const ETIQUETAS_CAMPO = { tipo: 'el tipo', empresa: 'la empresa', codigo: 'el código', fechaLimite: 'la fecha límite', monto: 'el monto', igv: 'el IGV' }

export function editarRecibo(id, cambios) {
  const actual = obtenerRecibo(id)
  // Las cuotas de préstamo y los recibos pagados no se editan (un pagado se corrige con corregirPago)
  if (!actual || actual.prestamoId || actual.estado === 'Pagado') return null
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
  // No se eliminan cuotas de préstamo ni recibos pagados (primero hay que anular el pago)
  if (!actual || actual.prestamoId || actual.estado === 'Pagado') return false
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

/** Corrige los datos de un pago ya registrado. datos: { monto, fecha, medio, comprobante } */
export function corregirPago(id, datos) {
  const actual = obtenerRecibo(id)
  if (!actual || actual.estado !== 'Pagado') return null
  const corregido = {
    ...actual,
    pago: { monto: datos.monto, fecha: datos.fecha, medio: datos.medio, comprobante: (datos.comprobante ?? '').trim() },
  }
  publicar({
    ...estado,
    recibos: estado.recibos.map((r) => (r.id === id ? corregido : r)),
    historial: anotar(estado.historial, 'corregir-pago', `Corrigió el pago del recibo de ${actual.empresa}`),
  })
  return corregido
}

/** Anula el pago: se borran sus datos y el recibo vuelve a Pendiente (o Vencido si ya pasó su fecha). */
export function anularPago(id) {
  const actual = obtenerRecibo(id)
  if (!actual || actual.estado !== 'Pagado') return null
  const anulado = { ...actual, estado: 'Pendiente', pago: null }
  publicar({
    ...estado,
    recibos: estado.recibos.map((r) => (r.id === id ? anulado : r)),
    historial: anotar(estado.historial, 'anular-pago', `Anuló el pago del recibo de ${actual.empresa}`),
  })
  return anulado
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
  const correlativo = estado.prestamos.length + 1
  const codigoBase = `PRE-${String(correlativo).padStart(4, '0')}`
  const prestamo = {
    id: nuevoId('p'),
    entidad: datos.entidad.trim(),
    montoTotal: datos.montoTotal,
    numCuotas: datos.numCuotas,
    montoCuota: datos.montoCuota,
    primeraFecha: datos.primeraFecha,
    correlativo,
    creadoEn: new Date().toISOString(),
  }
  const cuotas = calcularCuotas(datos).map((c) => {
    return {
      id: nuevoId('r'),
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
