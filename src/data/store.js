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
import { hayNube, leerNube, sincronizarNube, suscribirCambios, borrarVoucher } from './persistencia'
import { hoyISO, FECHA_MINIMA, fechaEnRango, sumarMeses, partes } from '../utils/fechas'
import { PERFILES, MAX_CUOTAS, LIMITE_CUOTA, LIMITE_PRESTAMO, LIMITE_MONTO } from '../config/constantes'
import { codigoValido } from '../utils/validacion'

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

/**
 * Corrige fechas fuera del rango permitido (por ejemplo, datos locales guardados
 * por versiones antiguas de la app). Las fechas de pago tampoco pueden ser futuras.
 */
function repararFechas(datos) {
  const hoy = hoyISO()
  const fecha = (f) => (fechaEnRango(f) ? f : hoy)
  const fechaPago = (f) => (fechaEnRango(f, FECHA_MINIMA, hoy) ? f : hoy)
  const recibos = (datos.recibos ?? []).map((r) => {
    const pago = r.pago?.fecha ? { ...r.pago, fecha: fechaPago(r.pago.fecha) } : r.pago
    return { ...r, fechaLimite: fecha(r.fechaLimite), pago }
  })
  const prestamos = (datos.prestamos ?? []).map((p) => ({ ...p, primeraFecha: fecha(p.primeraFecha) }))
  return { ...datos, recibos, prestamos }
}

/** Carga los datos al abrir la app (desde Supabase o localStorage). Llamar una vez. */
export async function iniciarDatos() {
  if (usaNube) {
    try {
      const d = repararFechas(await leerNube())
      if (d.recibos.length + d.prestamos.length + d.historial.length === 0) {
        // Base vacía: primer arranque, se cargan los datos de ejemplo
        const ejemplo = crearDatosEjemplo()
        estado = { seq: 0, recibos: [], prestamos: [], historial: [] }
        publicar(ejemplo)
      } else {
        estado = { seq: 0, ...d }
      }
      // Se refresca la copia local para que, si Supabase no responde, no vuelvan
      // a aparecer datos antiguos.
      guardarLocal(estado)
      return
    } catch (e) {
      usaNube = false // no se pudo conectar: se sigue con localStorage
      avisarError(`No se pudo conectar con Supabase (${e.message}). Se usan datos locales.`)
    }
  }
  estado = repararFechas(leerLocal() ?? crearDatosEjemplo())
  guardarLocal(estado)
}

// Huella de los datos (sin importar el orden) para saber si algo cambió de verdad
const huella = (e) => JSON.stringify([e.recibos, e.prestamos, e.historial].map((l) => [...l].sort((a, b) => (a.id < b.id ? -1 : 1))))
let version = 0 // sube con cada cambio local: así una lectura vieja nunca pisa un cambio recién hecho

/** Vuelve a leer Supabase (cambios hechos desde otros dispositivos). Espera a los envíos pendientes. */
export function refrescar() {
  if (!usaNube) return
  cola = cola.then(async () => {
    const v = version
    try {
      const remoto = await leerNube()
      if (v !== version) return // hubo un cambio local mientras se leía: la próxima lectura lo recoge
      const nuevo = { ...estado, ...remoto }
      if (huella(nuevo) === huella(estado)) return // nada cambió: no se redibuja
      estado = nuevo
      notificar()
    } catch {
      /* sin conexión: se mantiene lo que ya se ve */
    }
  })
}

/**
 * Mantiene todos los dispositivos al día: Supabase Realtime avisa al instante y, por si el
 * tiempo real no estuviera activado, se vuelve a leer cada 5 segundos mientras la app se ve.
 */
export function iniciarSincronizacion() {
  if (!usaNube) return
  let espera
  const alCambiar = () => {
    clearTimeout(espera)
    espera = setTimeout(refrescar, 250)
  }
  suscribirCambios(alCambiar)
  // En celulares la conexión de tiempo real se corta al pausar la app: se reabre al volver
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') suscribirCambios(alCambiar)
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') refrescar()
  }, 5000)
}

function publicar(nuevo) {
  const previo = estado
  estado = nuevo
  version++
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

// ── Motivo de los rechazos ──────────────────────────────────────────────────
// Las funciones que validan devuelven null cuando no guardan. Antes la pantalla no sabía por qué
// (y mostraba siempre un error de fecha). Ahora cada rechazo deja { mensaje, campo }: el texto
// para el usuario y el campo del formulario al que corresponde ('general' si no es de un campo).
let ultimoRechazo = null
function rechazar(mensaje, campo = 'general') {
  ultimoRechazo = { mensaje, campo }
  return null
}
/** Motivo del último rechazo. Llamar justo después de que una función devuelva null. */
export const motivoRechazo = () => ultimoRechazo ?? { mensaje: 'No se pudo guardar. Actualiza la pantalla e inténtalo de nuevo.', campo: 'general' }

const MSG_FECHA = 'La fecha límite debe estar entre el 1 de enero de 2026 y el 31 de diciembre de 2050.'
const MSG_MONTO = 'El monto debe ser mayor a cero y tener como máximo 10 dígitos enteros y 2 decimales.'
const montoValido = (m) => Number.isFinite(m) && m > 0 && m <= LIMITE_MONTO

/** Valida los datos de un préstamo (nuevo o editado). Devuelve true, o false dejando el motivo. */
function prestamoValido(datos) {
  if (!fechaEnRango(datos.primeraFecha)) return !rechazar('La fecha de la primera cuota debe estar entre el 1 de enero de 2026 y el 31 de diciembre de 2050.', 'primera')
  if (!Number.isInteger(datos.numCuotas) || datos.numCuotas < 1 || datos.numCuotas > MAX_CUOTAS) return !rechazar(`El número de cuotas debe ser de 1 a ${MAX_CUOTAS}.`, 'num')
  if (!(datos.montoCuota > 0)) return !rechazar('Escribe el monto de cada cuota.', 'cuota')
  if (datos.montoCuota > LIMITE_CUOTA) return !rechazar('El monto de cada cuota no puede superar los 10 dígitos enteros.', 'cuota')
  if (!(datos.montoTotal > 0)) return !rechazar('El monto total del préstamo debe ser mayor a cero.', 'cuota')
  if (datos.montoTotal > LIMITE_PRESTAMO) return !rechazar('El monto total del préstamo (suma de las cuotas) no puede superar S/ 9,999,999,999.99. Baja el monto o el número de cuotas.', 'cuota')
  return true
}

// ── Consultas ───────────────────────────────────────────────────────────────
export function obtenerRecibo(id) {
  return estado.recibos.find((r) => r.id === id) ?? null
}
export function obtenerPrestamo(id) {
  return estado.prestamos.find((p) => p.id === id) ?? null
}

/** Busca un recibo con el mismo código (sin distinguir mayúsculas ni espacios). */
export function buscarDuplicado(codigo, ignorarId = null) {
  return (
    estado.recibos.find(
      (r) => r.id !== ignorarId && normalizar(r.codigo) === normalizar(codigo),
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
  if (!fechaEnRango(datos.fechaLimite)) return rechazar(MSG_FECHA, 'fecha')
  if (!codigoValido(datos.tipo, datos.codigo)) return rechazar('El código no tiene el formato correcto para este tipo de recibo.', 'codigo')
  if (!montoValido(datos.monto)) return rechazar(MSG_MONTO, 'monto')
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
  if (!actual) return rechazar('Este recibo ya no existe. Vuelve al calendario y actualiza la pantalla.')
  if (actual.prestamoId) return rechazar('Las cuotas de un préstamo no se pueden editar.')
  if (actual.estado === 'Pagado') return rechazar('Este recibo ya fue pagado (puede haberse pagado desde otro dispositivo), por eso no se puede editar. Vuelve al detalle para ver su estado actual.')
  if (cambios.fechaLimite !== undefined && !fechaEnRango(cambios.fechaLimite)) return rechazar(MSG_FECHA, 'fecha')
  if (cambios.monto !== undefined && !montoValido(cambios.monto)) return rechazar(MSG_MONTO, 'monto')
  const nuevo = { ...actual, ...cambios, empresa: (cambios.empresa ?? actual.empresa).trim(), codigo: (cambios.codigo ?? actual.codigo).trim() }
  if (!codigoValido(nuevo.tipo, nuevo.codigo)) return rechazar('El código no tiene el formato correcto para este tipo de recibo.', 'codigo')
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

/** La fecha de pago debe estar dentro del rango y no puede ser futura. */
function fechaPagoValida(fecha) {
  return fechaEnRango(fecha, FECHA_MINIMA, hoyISO())
}

/**
 * Registra el pago de un recibo. datos: { interes, fecha, medio, foto, fotoPath }.
 * En las cuotas de préstamo el monto pagado se calcula como cuota + mora/interés.
 * Nunca puede ser menor al monto del recibo o de la cuota.
 */
export function registrarPago(id, datos) {
  const actual = obtenerRecibo(id)
  if (!actual) return rechazar('Este recibo ya no existe. Vuelve al calendario y actualiza la pantalla.')
  if (actual.estado === 'Pagado') return rechazar('Este recibo ya figura como pagado (puede haberse pagado desde otro dispositivo). Cierra esta ventana para ver su estado actual.')
  if (!fechaPagoValida(datos.fecha)) return rechazar('La fecha de pago debe estar entre el 1 de enero de 2026 y hoy.', 'fecha')
  const interes = actual.prestamoId ? Number(datos.interes ?? 0) : 0
  if (!Number.isFinite(interes) || interes < 0) return rechazar('La mora o interés debe ser un monto válido, mayor o igual a cero.', 'interes')
  const monto = actual.prestamoId ? Math.round((actual.monto + interes) * 100) / 100 : actual.monto
  if (!(monto > 0) || monto < actual.monto) return rechazar('El monto pagado no puede ser menor al monto del recibo.', 'monto')
  const pagado = {
    ...actual,
    estado: 'Pagado',
    pago: {
      monto,
      interes,
      fecha: datos.fecha,
      medio: datos.medio,
      foto: datos.foto ?? null,
      fotoPath: datos.fotoPath ?? null,
    },
  }
  publicar({
    ...estado,
    recibos: estado.recibos.map((r) => (r.id === id ? pagado : r)),
    historial: anotar(estado.historial, 'pago', `Registró el pago del recibo de ${actual.empresa}`),
  })
  return pagado
}

/** Corrige la fecha, el medio y la foto de un pago ya registrado. El monto no se modifica. */
export function corregirPago(id, datos) {
  const actual = obtenerRecibo(id)
  if (!actual) return rechazar('Este recibo ya no existe. Vuelve al calendario y actualiza la pantalla.')
  if (actual.estado !== 'Pagado') return rechazar('Este recibo ya no figura como pagado. Cierra esta ventana para ver su estado actual.')
  if (!fechaPagoValida(datos.fecha)) return rechazar('La fecha de pago debe estar entre el 1 de enero de 2026 y hoy.', 'fecha')
  const corregido = {
    ...actual,
    pago: {
      ...actual.pago,
      monto: actual.pago.monto,
      fecha: datos.fecha,
      medio: datos.medio,
      foto: datos.foto ?? null,
      fotoPath: datos.fotoPath ?? null,
    },
  }
  publicar({
    ...estado,
    recibos: estado.recibos.map((r) => (r.id === id ? corregido : r)),
    historial: anotar(estado.historial, 'corregir-pago', `Corrigió el pago del recibo de ${actual.empresa}`),
  })
  // Si se cambió la foto, la anterior se borra del almacenamiento
  if (actual.pago?.fotoPath && actual.pago.fotoPath !== corregido.pago.fotoPath) borrarVoucher(actual.pago.fotoPath)
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
  borrarVoucher(actual.pago?.fotoPath) // al anular el pago también se borra su foto
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
  if (actor !== 'asistente') return rechazar('Solo el asistente puede registrar préstamos.') // los préstamos los gestiona el asistente
  if (!prestamoValido(datos)) return null
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

/**
 * Cómo quedarían las cuotas al editar un préstamo. Las cuotas YA PAGADAS no se tocan (siguen con su
 * fecha y monto); las demás se recalculan con el monto y la fecha de primera cuota indicados.
 * Si ya hay pagos, editarPrestamo impide cambiar el monto de cada cuota; aquí solo se recalculan
 * fechas y las cuotas nuevas.
 * Devuelve { cuotas: [{ numero, fechaLimite, monto, pagada }], minimoCuotas }.
 */
export function planEdicionPrestamo(id, { numCuotas, montoCuota, primeraFecha }) {
  const existentes = estado.recibos.filter((r) => r.prestamoId === id)
  const pagadas = new Map(existentes.filter((r) => r.estado === 'Pagado').map((r) => [r.cuota, r]))
  const minimoCuotas = Math.max(0, ...pagadas.keys()) // no se puede dejar menos cuotas que las ya pagadas
  const dia = partes(primeraFecha).d
  const cuotas = Array.from({ length: numCuotas }, (_, i) => {
    const numero = i + 1
    const pagada = pagadas.get(numero)
    return pagada
      ? { numero, fechaLimite: pagada.fechaLimite, monto: pagada.monto, pagada: true }
      : { numero, fechaLimite: sumarMeses(primeraFecha, i, dia), monto: montoCuota, pagada: false }
  })
  return { cuotas, minimoCuotas }
}

/** Edita un préstamo: banco, número de cuotas, monto de cuota y fecha de la primera cuota. */
export function editarPrestamo(id, datos) {
  const actual = obtenerPrestamo(id)
  if (!actual) return rechazar('Este préstamo ya no existe. Vuelve a Préstamos y actualiza la pantalla.')
  if (actor !== 'asistente') return rechazar('Solo el asistente puede editar préstamos.')
  if (!prestamoValido(datos)) return null
  // Si ya hay cuotas pagadas, el monto de cada cuota no puede cambiar.
  const hayPagadas = estado.recibos.some((r) => r.prestamoId === id && r.estado === 'Pagado')
  if (hayPagadas && Math.abs(Number(datos.montoCuota) - Number(actual.montoCuota)) > 0.005) return rechazar('Ya hay cuotas pagadas (puede haberse pagado una desde otro dispositivo): el monto de cada cuota no se puede cambiar.', 'cuota')
  const { cuotas, minimoCuotas } = planEdicionPrestamo(id, datos)
  if (datos.numCuotas < minimoCuotas) return rechazar(`Ya hay cuotas pagadas hasta la ${minimoCuotas}: no puede haber menos cuotas.`, 'num')
  const entidad = datos.entidad.trim()
  const codigoBase = `PRE-${String(actual.correlativo).padStart(4, '0')}`
  const porNumero = new Map(estado.recibos.filter((r) => r.prestamoId === id).map((r) => [r.cuota, r]))
  const ahora = new Date().toISOString()
  const nuevas = cuotas.map((c) => {
    const previa = porNumero.get(c.numero)
    const comun = { empresa: entidad, codigo: `${codigoBase}-C${c.numero}/${datos.numCuotas}` }
    if (previa) return { ...previa, ...comun, ...(c.pagada ? {} : { fechaLimite: c.fechaLimite, monto: c.monto }) }
    return { id: nuevoId('r'), tipo: 'Préstamo', ...comun, fechaLimite: c.fechaLimite, monto: c.monto, igv: null, estado: 'Pendiente', pago: null, prestamoId: id, cuota: c.numero, creadoEn: ahora }
  })
  const total = Math.round(nuevas.reduce((t, r) => t + r.monto, 0) * 100) / 100
  // Si no queda ninguna cuota pendiente, el monto de cuota del préstamo no cambia:
  // no tendría ninguna cuota donde aplicarse y quedaría un dato inconsistente.
  const montoCuota = nuevas.some((r) => r.estado !== 'Pagado') ? datos.montoCuota : actual.montoCuota
  const prestamo = { ...actual, entidad, numCuotas: datos.numCuotas, montoCuota, primeraFecha: datos.primeraFecha, montoTotal: total }
  publicar({
    ...estado,
    prestamos: estado.prestamos.map((p) => (p.id === id ? prestamo : p)),
    recibos: [...estado.recibos.filter((r) => r.prestamoId !== id), ...nuevas],
    historial: anotar(estado.historial, 'editar', `Editó el préstamo de ${entidad}`),
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
    totalCuotas: Math.round(cuotas.reduce((s, c) => s + c.monto, 0) * 100) / 100, // suma de todas las cuotas
    proximo: pendientes[0]?.fechaLimite ?? null,
  }
}

// ── Ingreso y pruebas ───────────────────────────────────────────────────────
/** Registra "Ingresó al sistema" con el perfil que entró. */
export function registrarIngreso(perfil) {
  definirActor(perfil)
}

/** Solo para pruebas: vuelve a cargar los datos de ejemplo (y reinicia el historial). */
export function reiniciarDatos() {
  publicar(crearDatosEjemplo())
}

/** Borra todo el historial de acciones sin tocar recibos ni préstamos. */
export function limpiarHistorial() {
  publicar({
    ...estado,
    historial: [],
  })
}
