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
import { hayNube, leerNube, sincronizarNube, suscribirCambios, borrarVoucher, confirmarVersiones } from './persistencia'
import { hoyISO, FECHA_MINIMA, fechaMaximaRecibo, fechaMaxima, fechaEnRango, formatoFecha, sumarMeses, partes, textoRangoFechas } from '../utils/fechas'
import { formatoSoles } from '../utils/dinero'
import { PERFILES, MAX_CUOTAS, LIMITE_CUOTA, LIMITE_PRESTAMO, LIMITE_MONTO, NOMBRE_MIN, NOMBRE_MAX, DIAS_MAXIMOS_RECIBO, CODIGO_MAX } from '../config/constantes'
import { codigoValido, limpiarNombre, sinTildes } from '../utils/validacion'

const CLAVE = 'pagosCastillo.datos.v1'
const ESPERA_CARGA_MS = 10000 // si la base no responde en este tiempo, se usan los datos de este dispositivo

// ── Estado en memoria + suscriptores (para que React se entere de los cambios) ──
let estado = { seq: 0, recibos: [], prestamos: [], historial: [] }
const oyentes = new Set()
let actor = null // 'asistente' | 'gerente' (quién hace los cambios)
let usaNube = hayNube
let cola = Promise.resolve() // los envíos a Supabase salen de uno en uno y en orden

// tecnico: detalle para la consola. usuario: texto que ve la persona (si no se da, un aviso general de conexión).
function avisarError(tecnico, usuario) {
  console.error('[Pagos Castillo]', tecnico)
  const general = 'Hubo un problema al guardar o cargar los datos. Revisa tu conexión e inténtalo de nuevo.'
  window.dispatchEvent(new CustomEvent('pagos:error', { detail: usuario ?? general }))
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

const conTiempo = (promesa, ms) =>
  Promise.race([promesa, new Promise((_, rechazo) => setTimeout(() => rechazo(new Error('tiempo de espera agotado')), ms))])

/** Carga los datos al abrir la app (desde Supabase o localStorage). Llamar una vez. */
export async function iniciarDatos() {
  if (usaNube) {
    try {
      const d = await conTiempo(leerNube(), ESPERA_CARGA_MS)
      confirmarVersiones(d)
      // Una base vacía se queda vacía: los datos de ejemplo solo se usan sin Supabase (modo local).
      // Antes se volvían a crear solos cada vez que se borraba todo, y el préstamo de ejemplo reaparecía.
      estado = { seq: 0, ...d }
      // Se refresca la copia local para que, si Supabase no responde, no vuelvan
      // a aparecer datos antiguos.
      guardarLocal(estado)
      return
    } catch (e) {
      usaNube = false // no se pudo conectar: se sigue con localStorage
      avisarError(`No se pudo conectar con Supabase (${e.message}). Se usan datos locales.`, 'No se pudo conectar con la base de datos. Se muestran los datos guardados en este dispositivo.')
    }
  }
  estado = leerLocal() ?? crearDatosEjemplo()
  guardarLocal(estado)
}

// Huella de los datos (sin importar el orden) para saber si algo cambió de verdad
const huella = (e) => JSON.stringify([e.recibos, e.prestamos, e.historial].map((l) => [...l].sort((a, b) => (a.id < b.id ? -1 : 1))))
let version = 0 // sube con cada cambio local: así una lectura vieja nunca pisa un cambio recién hecho

/** Vuelve a leer Supabase (cambios hechos desde otros dispositivos). Espera a los envíos pendientes. */
export function refrescar() {
  if (!usaNube) return
  // La versión local se anota AL PEDIR la lectura (no cuando le toca el turno en la cola): si entre tanto
  // se hizo un cambio local, esta lectura queda vieja y se descarta, aunque su turno llegue después.
  const v = version
  cola = cola.then(async () => {
    try {
      const remoto = await leerNube()
      if (v !== version) return // hubo un cambio local mientras se leía: la próxima lectura lo recoge
      confirmarVersiones(remoto) // esta lectura es la que se muestra: desde aquí se guarda comparando contra ella
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

let generacion = 0 // sube cuando hay un conflicto: los guardados pendientes (hechos sobre datos viejos) se descartan

function publicar(nuevo) {
  const previo = estado
  estado = nuevo
  version++
  if (usaNube) {
    const miGeneracion = generacion
    cola = cola
      .then(() => (miGeneracion === generacion ? sincronizarNube(previo, nuevo) : undefined))
      .catch((e) => (e.conflicto ? resolverConflicto(nuevo, e) : avisarError(`No se pudo guardar en Supabase: ${e.message}`)))
  } else {
    guardarLocal(nuevo)
  }
  notificar()
}

/**
 * Otro dispositivo cambió la misma fila a la vez: el cambio local NO se guardó. Se vuelve a leer la base
 * para mostrar lo último, se borran las fotos que se alcanzaron a subir y se avisa a la persona.
 */
async function resolverConflicto(fallido, e) {
  generacion++
  try {
    const lectura = await leerNube()
    confirmarVersiones(lectura)
    estado = { ...estado, ...lectura }
    version++
    notificar()
    const usadas = new Set(lectura.recibos.map((r) => r.pago?.fotoPath).filter(Boolean))
    fallido.recibos.forEach((r) => {
      const ruta = r.pago?.fotoPath
      if (ruta && !usadas.has(ruta)) borrarVoucher(ruta)
    })
  } catch {
    /* sin conexión: la próxima lectura periódica actualiza la pantalla */
  }
  avisarError(e.message, 'Otro dispositivo cambió este dato al mismo tiempo, así que tu cambio no se guardó. La pantalla ya muestra lo último; revisa y vuelve a intentarlo.')
}

export const suscribir = (f) => {
  oyentes.add(f)
  return () => oyentes.delete(f)
}
export const obtenerEstado = () => estado

/** Define quién está usando el sistema (para el historial y los permisos). */
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
// Para comparar nombres y códigos: sin mayúsculas, sin espacios y sin tildes ("Telefónica" = "telefonica")
const normalizar = (t) => sinTildes(t).toLowerCase().replace(/\s+/g, '')

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

/** Las acciones de registro (recibos, pagos y préstamos) son del asistente; el gerente solo consulta. */
const esAsistente = () => actor === 'asistente'
const SOLO_ASISTENTE = 'Solo el asistente puede registrar y modificar datos. El gerente solo consulta.'

const MSG_CODIGO = `El código debe tener entre 1 y ${CODIGO_MAX} caracteres: letras, números y - _ / .`
const MSG_DUPLICADO = 'Este código ya está registrado. Cada recibo debe tener un código distinto.'
const MSG_MONTO = 'El monto debe ser mayor a cero y tener como máximo 10 dígitos enteros y 2 decimales.'
const montoValido = (m) => Number.isFinite(m) && m > 0 && m <= LIMITE_MONTO

/** Largo del nombre de una empresa, entidad o banco. Devuelve el mensaje de error o null. */
function errorDeNombre(nombre) {
  const largo = limpiarNombre(nombre).length
  if (largo < NOMBRE_MIN) return `El nombre debe tener al menos ${NOMBRE_MIN} caracteres.`
  if (largo > NOMBRE_MAX) return `El nombre no puede tener más de ${NOMBRE_MAX} caracteres.`
  return null
}

/** Nombre del titular (a nombre de quién está el recibo o el préstamo). Devuelve el mensaje de error o null. */
function errorDeTitular(titular, obligatorio = true) {
  const largo = limpiarNombre(titular).length
  if (largo === 0) return obligatorio ? 'Escribe el nombre del titular.' : null
  if (largo < NOMBRE_MIN) return `El nombre del titular debe tener al menos ${NOMBRE_MIN} caracteres.`
  if (largo > NOMBRE_MAX) return `El nombre del titular no puede tener más de ${NOMBRE_MAX} caracteres.`
  return null
}

/** Valida los datos de un préstamo (nuevo o editado). Devuelve true, o false dejando el motivo. */
function prestamoValido(datos, cuotaBase = 1) {
  const errNombre = errorDeNombre(datos.entidad)
  if (errNombre) return rechazar(errNombre, 'entidad')
  if (!fechaEnRango(datos.primeraFecha)) return rechazar(`La fecha de la primera cuota debe estar ${textoRangoFechas()}.`, 'primera')
  if (!Number.isInteger(datos.numCuotas) || datos.numCuotas < 1 || datos.numCuotas > MAX_CUOTAS) return rechazar(`El número de cuotas debe ser de 1 a ${MAX_CUOTAS}.`, 'num')
  if (cuotaBase <= datos.numCuotas) {
    const ultima = sumarMeses(datos.primeraFecha, datos.numCuotas - cuotaBase, partes(datos.primeraFecha).d)
    if (ultima > fechaMaxima()) return rechazar(`La última cuota caería el ${formatoFecha(ultima)}, después del ${formatoFecha(fechaMaxima())}. Baja el número de cuotas o adelanta la primera fecha.`, 'num')
  }
  if (!(datos.montoCuota > 0)) return rechazar('Escribe el monto de cada cuota.', 'cuota')
  if (datos.montoCuota > LIMITE_CUOTA) return rechazar('El monto de cada cuota no puede superar los 10 dígitos enteros.', 'cuota')
  if (!(datos.montoTotal > 0)) return rechazar('El monto total del préstamo debe ser mayor a cero.', 'cuota')
  if (datos.montoTotal > LIMITE_PRESTAMO) return rechazar('El monto total del préstamo (suma de las cuotas) no puede superar S/ 9,999,999,999.99. Baja el monto o el número de cuotas.', 'cuota')
  return true
}

// ── Consultas ───────────────────────────────────────────────────────────────
export function obtenerRecibo(id) {
  return estado.recibos.find((r) => r.id === id) ?? null
}
export function obtenerPrestamo(id) {
  return estado.prestamos.find((p) => p.id === id) ?? null
}

// Recibos "sueltos": sin las cuotas de préstamo, cuyos códigos PRE-... son internos.
const sueltos = (ignorarId) => estado.recibos.filter((r) => !r.prestamoId && r.id !== ignorarId)

/**
 * Busca un recibo ya registrado con el mismo código de voucher (sin distinguir mayúsculas ni
 * espacios). El código de un voucher es único: no puede repetirse en otro recibo, sin importar
 * la empresa, el tipo ni el mes.
 */
export function buscarDuplicado({ codigo }, ignorarId = null) {
  return sueltos(ignorarId).find((r) => normalizar(r.codigo) === normalizar(codigo)) ?? null
}

/** Último medio de pago usado con una empresa (según pagos anteriores) o null. */
export function ultimoMedioDeEmpresa(empresa) {
  const pagos = estado.recibos
    .filter((r) => r.pago && normalizar(r.empresa) === normalizar(empresa))
    .sort((a, b) => (a.pago.fecha < b.pago.fecha ? 1 : a.pago.fecha > b.pago.fecha ? -1 : 0))
  return pagos[0]?.pago.medio ?? null
}

/** Busca otro pago que ya use exactamente la misma foto de voucher. */
export function buscarFotoRepetida(huellaFoto, ignorarId = null) {
  if (!huellaFoto) return null
  return estado.recibos.find((r) => r.id !== ignorarId && r.pago?.fotoHash === huellaFoto) ?? null
}

// ── Recibos ─────────────────────────────────────────────────────────────────
export function crearRecibo(datos) {
  if (!esAsistente()) return rechazar(SOLO_ASISTENTE)
  const errNombre = errorDeNombre(datos.empresa)
  if (errNombre) return rechazar(errNombre, 'empresa')
  const errTitular = errorDeTitular(datos.titular)
  if (errTitular) return rechazar(errTitular, 'titular')
  const fechaMin = FECHA_MINIMA
  const fechaMax = fechaMaximaRecibo()
  if (!fechaEnRango(datos.fechaLimite, fechaMin, fechaMax)) return rechazar(`La fecha límite debe estar entre el ${formatoFecha(fechaMin)} y el ${formatoFecha(fechaMax)} (hoy + ${DIAS_MAXIMOS_RECIBO} días).`, 'fecha')
  if (!codigoValido(datos.codigo)) return rechazar(MSG_CODIGO, 'codigo')
  if (!montoValido(datos.monto)) return rechazar(MSG_MONTO, 'monto')
  if (buscarDuplicado(datos)) return rechazar(MSG_DUPLICADO, 'codigo')
  const recibo = {
    id: nuevoId('r'),
    tipo: datos.tipo,
    empresa: limpiarNombre(datos.empresa),
    titular: limpiarNombre(datos.titular),
    codigo: datos.codigo.trim(),
    fechaLimite: datos.fechaLimite,
    monto: datos.monto,
    estado: 'Pendiente',
    pago: null,
    prestamoId: null,
    cuota: null,
    creadoEn: new Date().toISOString(),
  }
  publicar({
    ...estado,
    recibos: [...estado.recibos, recibo],
    historial: anotar(estado.historial, 'crear', `Registró el recibo de ${recibo.empresa} (${recibo.tipo}) por ${formatoSoles(recibo.monto)}, vence el ${formatoFecha(recibo.fechaLimite)}`),
  })
  return recibo
}

// Cómo se muestra cada dato en el historial cuando se edita
const CAMPOS_RECIBO = {
  tipo: ['el tipo', (v) => v],
  empresa: ['la empresa', (v) => v],
  titular: ['el titular', (v) => v ?? 'sin titular'],
  codigo: ['el código', (v) => v],
  fechaLimite: ['la fecha límite', formatoFecha],
  monto: ['el monto', formatoSoles],
}

export function editarRecibo(id, cambios) {
  if (!esAsistente()) return rechazar(SOLO_ASISTENTE)
  const actual = obtenerRecibo(id)
  // Las cuotas de préstamo y los recibos pagados no se editan (un pagado se corrige con corregirPago)
  if (!actual) return rechazar('Este recibo ya no existe. Vuelve al calendario y actualiza la pantalla.')
  if (actual.prestamoId) return rechazar('Las cuotas de un préstamo no se pueden editar.')
  if (actual.estado === 'Pagado') return rechazar('Este recibo ya fue pagado (puede haberse pagado desde otro dispositivo), por eso no se puede editar. Vuelve al detalle para ver su estado actual.')
  // El tipo de un recibo no cambia: cada tipo tiene su propio formato de código y sus reglas
  if (cambios.tipo !== undefined && cambios.tipo !== actual.tipo) return rechazar('El tipo de un recibo no se puede cambiar. Elimina el recibo y regístralo de nuevo con el tipo correcto.')
  if (cambios.empresa !== undefined) {
    const errNombre = errorDeNombre(cambios.empresa)
    if (errNombre) return rechazar(errNombre, 'empresa')
  }
  // Un recibo antiguo sin titular puede seguir sin él; si ya lo tiene, no se puede dejar vacío
  if (cambios.titular !== undefined) {
    const errTitular = errorDeTitular(cambios.titular, !!actual.titular)
    if (errTitular) return rechazar(errTitular, 'titular')
  }
  const fechaMax = fechaMaximaRecibo()
  if (cambios.fechaLimite !== undefined && !fechaEnRango(cambios.fechaLimite, FECHA_MINIMA, fechaMax) && cambios.fechaLimite !== actual.fechaLimite) {
    return rechazar(`La fecha límite debe estar entre el ${formatoFecha(FECHA_MINIMA)} y el ${formatoFecha(fechaMax)} (hoy + ${DIAS_MAXIMOS_RECIBO} días).`, 'fecha')
  }
  if (cambios.monto !== undefined && !montoValido(cambios.monto)) return rechazar(MSG_MONTO, 'monto')
  const nuevo = { ...actual, ...cambios, empresa: limpiarNombre(cambios.empresa ?? actual.empresa), codigo: (cambios.codigo ?? actual.codigo).trim(), titular: cambios.titular !== undefined ? limpiarNombre(cambios.titular) || undefined : actual.titular }
  if (!codigoValido(nuevo.codigo)) return rechazar(MSG_CODIGO, 'codigo')
  // Solo se comprueba si el código cambió: así se pueden corregir recibos antiguos que ya
  // compartían código (por ejemplo, los de ejemplo o los registrados antes de esta regla).
  if (normalizar(nuevo.codigo) !== normalizar(actual.codigo) && buscarDuplicado(nuevo, id)) return rechazar(MSG_DUPLICADO, 'codigo')
  const tocados = Object.keys(CAMPOS_RECIBO).filter((k) => (actual[k] ?? null) !== (nuevo[k] ?? null))
  if (!tocados.length) return actual // no hubo cambios: no se guarda ni se anota nada
  const detalle = tocados.map((k) => `${CAMPOS_RECIBO[k][0]} de ${CAMPOS_RECIBO[k][1](actual[k])} a ${CAMPOS_RECIBO[k][1](nuevo[k])}`).join('; ')
  publicar({
    ...estado,
    recibos: estado.recibos.map((r) => (r.id === id ? nuevo : r)),
    historial: anotar(estado.historial, 'editar', `Editó el recibo de ${nuevo.empresa} (${nuevo.codigo}): cambió ${detalle}`),
  })
  return nuevo
}

export function eliminarRecibo(id) {
  if (!esAsistente()) {
    rechazar(SOLO_ASISTENTE)
    return false
  }
  const actual = obtenerRecibo(id)
  // No se eliminan cuotas de préstamo ni recibos pagados
  if (!actual || actual.prestamoId || actual.estado === 'Pagado') return false
  publicar({
    ...estado,
    recibos: estado.recibos.filter((r) => r.id !== id),
    historial: anotar(estado.historial, 'eliminar', `Eliminó el recibo de ${actual.empresa} (${actual.codigo}) por ${formatoSoles(actual.monto)}`),
  })
  return true
}

/** La fecha de pago debe estar dentro del rango y no puede ser futura. */
function fechaPagoValida(fecha) {
  return fechaEnRango(fecha, FECHA_MINIMA, hoyISO())
}

/** Primera cuota anterior del mismo préstamo que sigue sin pagarse (las cuotas se pagan en orden), o null. */
export function cuotaPendienteAnterior(recibo) {
  if (!recibo?.prestamoId) return null
  const pendientes = estado.recibos.filter((r) => r.prestamoId === recibo.prestamoId && r.cuota < recibo.cuota && r.estado !== 'Pagado')
  return pendientes.length ? Math.min(...pendientes.map((r) => r.cuota)) : null
}

/**
 * Rango en que puede caer la fecha de pago de un recibo: desde el 1 de enero de 2026 hasta hoy.
 * En las cuotas de un préstamo además no puede ser antes del pago de la cuota anterior ni
 * después del pago de la cuota siguiente.
 */
export function rangoDePago(recibo) {
  let min = FECHA_MINIMA
  let motivoMin = 'inicio permitido'
  let max = hoyISO()
  let motivoMax = 'hoy'
  if (recibo.prestamoId) {
    const vecina = (n) => estado.recibos.find((r) => r.prestamoId === recibo.prestamoId && r.cuota === n)
    const anterior = vecina(recibo.cuota - 1)?.pago?.fecha
    if (anterior && anterior > min) {
      min = anterior
      motivoMin = 'fecha de pago de la cuota anterior'
    }
    const siguiente = vecina(recibo.cuota + 1)?.pago?.fecha
    if (siguiente && siguiente < max) {
      max = siguiente
      motivoMax = 'fecha de pago de la cuota siguiente'
    }
  }
  // Si el reloj de algún dispositivo estaba adelantado o atrasado al registrar, el mínimo podría quedar
  // después del máximo y no habría ninguna fecha elegible: en ese caso se deja al menos el día máximo.
  if (min > max) {
    min = max
    motivoMin = motivoMax
  }
  return { min, max, motivoMin, motivoMax }
}

function errorDeFechaPago(recibo, fecha) {
  const { min, max, motivoMin, motivoMax } = rangoDePago(recibo)
  if (fecha < min) return `La fecha de pago no puede ser anterior al ${formatoFecha(min)} (${motivoMin}).`
  if (fecha > max) return `La fecha de pago no puede ser posterior al ${formatoFecha(max)} (${motivoMax}).`
  return null
}

/**
 * Registra el pago de un recibo. datos: { interes, fecha, medio, foto, fotoPath, fotoHash }.
 * En las cuotas de préstamo el monto pagado se calcula como cuota + mora/interés.
 * Nunca puede ser menor al monto del recibo o de la cuota.
 */
export function registrarPago(id, datos) {
  if (!esAsistente()) return rechazar(SOLO_ASISTENTE)
  const actual = obtenerRecibo(id)
  if (!actual) return rechazar('Este recibo ya no existe. Vuelve al calendario y actualiza la pantalla.')
  if (actual.estado === 'Pagado') return rechazar('Este recibo ya figura como pagado (puede haberse pagado desde otro dispositivo). Cierra esta ventana para ver su estado actual.')
  if (!fechaPagoValida(datos.fecha)) return rechazar('La fecha de pago debe estar entre el 1 de enero de 2026 y hoy.', 'fecha')
  const anteriorPendiente = cuotaPendienteAnterior(actual)
  if (anteriorPendiente) return rechazar(`Las cuotas se pagan en orden: primero hay que pagar la cuota ${anteriorPendiente} de este préstamo.`)
  const errFecha = errorDeFechaPago(actual, datos.fecha)
  if (errFecha) return rechazar(errFecha, 'fecha')
  const interes = actual.prestamoId ? Number(datos.interes ?? 0) : 0
  if (!Number.isFinite(interes) || interes < 0) return rechazar('La mora o interés debe ser un monto válido, mayor o igual a cero.', 'interes')
  if (interes > actual.monto) return rechazar('La mora o interés no puede ser mayor al monto de la cuota. Revisa que no tenga un dígito de más.', 'interes')
  const monto = actual.prestamoId ? Math.round((actual.monto + interes) * 100) / 100 : actual.monto
  if (!(monto > 0) || monto < actual.monto) return rechazar('El monto pagado no puede ser menor al monto del recibo.', 'monto')
  const repetida = buscarFotoRepetida(datos.fotoHash, id)
  if (repetida) return rechazar(`Esta foto ya se usó en el pago del recibo de ${repetida.empresa} (${repetida.codigo}). Cada pago necesita su propio voucher.`, 'foto')
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
      fotoHash: datos.fotoHash ?? null,
    },
  }
  const cuotas = actual.prestamoId ? obtenerPrestamo(actual.prestamoId)?.numCuotas : null
  const de = actual.prestamoId ? `de la cuota ${actual.cuota}${cuotas ? `/${cuotas}` : ''} del préstamo de ${actual.empresa}` : `del recibo de ${actual.empresa}`
  publicar({
    ...estado,
    recibos: estado.recibos.map((r) => (r.id === id ? pagado : r)),
    historial: anotar(estado.historial, 'pago', `Registró el pago ${de}: ${formatoSoles(monto)} con ${datos.medio}`),
  })
  return pagado
}

/** Corrige la fecha, el medio y la foto de un pago ya registrado. El monto y la mora no se modifican. */
export function corregirPago(id, datos) {
  if (!esAsistente()) return rechazar(SOLO_ASISTENTE)
  const actual = obtenerRecibo(id)
  if (!actual) return rechazar('Este recibo ya no existe. Vuelve al calendario y actualiza la pantalla.')
  if (actual.estado !== 'Pagado') return rechazar('Este recibo ya no figura como pagado. Cierra esta ventana para ver su estado actual.')
  if (!fechaPagoValida(datos.fecha)) return rechazar('La fecha de pago debe estar entre el 1 de enero de 2026 y hoy.', 'fecha')
  // Solo se revisa si la fecha cambia: así se pueden corregir la foto o el medio de pagos antiguos
  const errFecha = datos.fecha !== actual.pago.fecha ? errorDeFechaPago(actual, datos.fecha) : null
  if (errFecha) return rechazar(errFecha, 'fecha')
  const fotoNueva = (datos.foto ?? null) !== (actual.pago.foto ?? null)
  const huellaFoto = fotoNueva ? (datos.fotoHash ?? null) : (actual.pago.fotoHash ?? null)
  if (fotoNueva) {
    // No se puede volver a subir la misma foto que ya tiene este pago (aunque se suba como archivo nuevo).
    if (huellaFoto && huellaFoto === (actual.pago.fotoHash ?? null)) {
      return rechazar('Esta es la misma foto que ya tiene este pago. Elige una foto distinta.', 'foto')
    }
    const repetida = buscarFotoRepetida(huellaFoto, id)
    if (repetida) return rechazar(`Esta foto ya se usó en el pago del recibo de ${repetida.empresa} (${repetida.codigo}). Cada pago necesita su propio voucher.`, 'foto')
  }
  const corregido = {
    ...actual,
    pago: {
      ...actual.pago,
      monto: actual.pago.monto,
      fecha: datos.fecha,
      medio: datos.medio,
      foto: datos.foto ?? null,
      fotoPath: datos.fotoPath ?? null,
      fotoHash: huellaFoto,
    },
  }
  const cambios = []
  if (actual.pago.fecha !== corregido.pago.fecha) cambios.push(`fecha de pago de ${formatoFecha(actual.pago.fecha)} a ${formatoFecha(corregido.pago.fecha)}`)
  if (actual.pago.medio !== corregido.pago.medio) cambios.push(`medio de pago de ${actual.pago.medio} a ${corregido.pago.medio}`)
  if ((actual.pago.foto ?? null) !== (corregido.pago.foto ?? null)) cambios.push('la foto del voucher')
  if (!cambios.length) return actual // no hubo cambios: no se guarda ni se anota nada
  publicar({
    ...estado,
    recibos: estado.recibos.map((r) => (r.id === id ? corregido : r)),
    historial: anotar(estado.historial, 'corregir-pago', `Corrigió el pago del recibo de ${actual.empresa}: cambió ${cambios.join('; ')}`),
  })
  // Si se cambió la foto, la anterior se borra del almacenamiento
  if (actual.pago?.fotoPath && actual.pago.fotoPath !== corregido.pago.fotoPath) borrarVoucher(actual.pago.fotoPath)
  return corregido
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
  if (!esAsistente()) return rechazar('Solo el asistente puede registrar préstamos.') // los préstamos los gestiona el asistente
  if (!prestamoValido(datos)) return null
  const errTitular = errorDeTitular(datos.titular)
  if (errTitular) return rechazar(errTitular, 'titular')
  const entidad = limpiarNombre(datos.entidad)
  const repetido = estado.prestamos.find(
    (p) => normalizar(p.entidad) === normalizar(entidad) && p.numCuotas === datos.numCuotas && Math.abs(p.montoCuota - datos.montoCuota) < 0.005 && p.primeraFecha === datos.primeraFecha,
  )
  if (repetido) return rechazar('Ya existe un préstamo igual (mismo banco, número de cuotas, monto de cuota y fecha de la primera cuota).')
  const correlativo = Math.max(0, ...estado.prestamos.map((p) => p.correlativo)) + 1
  const codigoBase = `PRE-${String(correlativo).padStart(4, '0')}`
  const prestamo = {
    id: nuevoId('p'),
    entidad,
    titular: limpiarNombre(datos.titular),
    montoTotal: datos.montoTotal,
    numCuotas: datos.numCuotas,
    montoCuota: datos.montoCuota,
    primeraFecha: datos.primeraFecha,
    correlativo,
    creadoEn: new Date().toISOString(),
  }
  const cuotas = calcularCuotas(datos).map((c) => ({
    id: nuevoId('r'),
    tipo: 'Préstamo',
    empresa: prestamo.entidad,
    titular: prestamo.titular,
    codigo: `${codigoBase}-C${c.numero}/${datos.numCuotas}`,
    fechaLimite: c.fechaLimite,
    monto: c.monto,
    estado: 'Pendiente',
    pago: null,
    prestamoId: prestamo.id,
    cuota: c.numero,
    creadoEn: prestamo.creadoEn,
  }))
  publicar({
    ...estado,
    prestamos: [...estado.prestamos, prestamo],
    recibos: [...estado.recibos, ...cuotas],
    historial: anotar(estado.historial, 'prestamo', `Registró el préstamo de ${prestamo.entidad}: ${prestamo.numCuotas} cuotas de ${formatoSoles(prestamo.montoCuota)} desde el ${formatoFecha(prestamo.primeraFecha)}`),
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
  // La fecha recibida es la de la primera cuota pendiente (o la primera cuota si aún no hay pagos).
  const primeraPendiente = existentes.filter((r) => r.estado !== 'Pagado').sort((a, b) => a.cuota - b.cuota)[0]
  const cuotaBase = primeraPendiente?.cuota ?? 1
  const dia = partes(primeraFecha).d
  const cuotas = Array.from({ length: numCuotas }, (_, i) => {
    const numero = i + 1
    const pagada = pagadas.get(numero)
    return pagada
      ? { numero, fechaLimite: pagada.fechaLimite, monto: pagada.monto, pagada: true }
      : { numero, fechaLimite: sumarMeses(primeraFecha, numero - cuotaBase, dia), monto: montoCuota, pagada: false }
  })
  return { cuotas, minimoCuotas }
}

/** Edita un préstamo: banco, monto de cuota y fecha de las cuotas pendientes. El número de cuotas no cambia. */
export function editarPrestamo(id, datos) {
  const actual = obtenerPrestamo(id)
  if (!actual) return rechazar('Este préstamo ya no existe. Vuelve a Préstamos y actualiza la pantalla.')
  if (!esAsistente()) return rechazar('Solo el asistente puede editar préstamos.')
  if (datos.numCuotas !== actual.numCuotas) return rechazar('El número de cuotas no se puede cambiar al editar un préstamo.', 'num')
  const cuotasActuales = estado.recibos.filter((r) => r.prestamoId === id)
  const hayPagadas = cuotasActuales.some((r) => r.estado === 'Pagado')
  const cuotaUnoPagada = cuotasActuales.some((r) => r.cuota === 1 && r.estado === 'Pagado')
  const primeraPendienteActual = cuotasActuales.filter((r) => r.estado !== 'Pagado').sort((a, b) => a.cuota - b.cuota)[0] ?? null
  const cuotaBase = primeraPendienteActual?.cuota ?? datos.numCuotas + 1
  if (!prestamoValido(datos, cuotaBase)) return null
  // Un préstamo antiguo sin titular puede seguir sin él; si ya lo tiene, no se puede dejar vacío
  const errTitular = errorDeTitular(datos.titular, !!actual.titular)
  if (errTitular) return rechazar(errTitular, 'titular')
  // Si ya hay cuotas pagadas, el monto de cada cuota no puede cambiar.
  if (hayPagadas && Math.abs(Number(datos.montoCuota) - Number(actual.montoCuota)) > 0.005) return rechazar('Ya hay cuotas pagadas (puede haberse pagado una desde otro dispositivo): el monto de cada cuota no se puede cambiar.', 'cuota')
  const { cuotas, minimoCuotas } = planEdicionPrestamo(id, datos)
  if (datos.numCuotas < minimoCuotas) return rechazar(`Ya hay cuotas pagadas hasta la ${minimoCuotas}: no puede haber menos cuotas.`, 'num')
  // Las cuotas pendientes no pueden quedar con fecha anterior a la de las ya pagadas
  const ultimaPagada = cuotas.filter((c) => c.pagada).reduce((m, c) => (c.fechaLimite > m ? c.fechaLimite : m), '')
  if (ultimaPagada && cuotas.some((c) => !c.pagada && c.fechaLimite < ultimaPagada)) {
    return rechazar(`Las cuotas pendientes no pueden vencer antes de la última cuota pagada (${formatoFecha(ultimaPagada)}). Ajusta la fecha de la cuota pendiente.`, 'primera')
  }
  const entidad = limpiarNombre(datos.entidad)
  const titular = limpiarNombre(datos.titular) || undefined
  const codigoBase = `PRE-${String(actual.correlativo).padStart(4, '0')}`
  const porNumero = new Map(estado.recibos.filter((r) => r.prestamoId === id).map((r) => [r.cuota, r]))
  const ahora = new Date().toISOString()
  const nuevas = cuotas.map((c) => {
    const previa = porNumero.get(c.numero)
    const comun = { empresa: entidad, titular, codigo: `${codigoBase}-C${c.numero}/${datos.numCuotas}` }
    if (previa) return { ...previa, ...comun, ...(c.pagada ? {} : { fechaLimite: c.fechaLimite, monto: c.monto }) }
    return { id: nuevoId('r'), tipo: 'Préstamo', ...comun, fechaLimite: c.fechaLimite, monto: c.monto, estado: 'Pendiente', pago: null, prestamoId: id, cuota: c.numero, creadoEn: ahora }
  })
  const total = Math.round(nuevas.reduce((t, r) => t + r.monto, 0) * 100) / 100
  // Si no queda ninguna cuota pendiente, el monto de cuota del préstamo no cambia:
  // no tendría ninguna cuota donde aplicarse y quedaría un dato inconsistente.
  const montoCuota = nuevas.some((r) => r.estado !== 'Pagado') ? datos.montoCuota : actual.montoCuota
  // Si la primera cuota ya se pagó, su fecha es histórica: se conserva. La fecha editada es la de la primera pendiente.
  const primeraFecha = cuotaUnoPagada ? actual.primeraFecha : datos.primeraFecha
  const prestamo = { ...actual, entidad, titular, numCuotas: datos.numCuotas, montoCuota, primeraFecha, montoTotal: total }
  const cambios = []
  if (actual.entidad !== prestamo.entidad) cambios.push(`el banco de ${actual.entidad} a ${prestamo.entidad}`)
  if ((actual.titular ?? '') !== (prestamo.titular ?? '')) cambios.push(`el titular de ${actual.titular ?? 'sin titular'} a ${prestamo.titular ?? 'sin titular'}`)
  if (actual.numCuotas !== prestamo.numCuotas) cambios.push(`las cuotas de ${actual.numCuotas} a ${prestamo.numCuotas}`)
  if (Math.abs(actual.montoCuota - prestamo.montoCuota) > 0.005) cambios.push(`el monto de cuota de ${formatoSoles(actual.montoCuota)} a ${formatoSoles(prestamo.montoCuota)}`)
  if (actual.primeraFecha !== prestamo.primeraFecha) cambios.push(`la primera fecha de ${formatoFecha(actual.primeraFecha)} a ${formatoFecha(prestamo.primeraFecha)}`)
  if (cuotaUnoPagada && primeraPendienteActual && datos.primeraFecha !== primeraPendienteActual.fechaLimite) {
    cambios.push(`la fecha de las cuotas pendientes de ${formatoFecha(primeraPendienteActual.fechaLimite)} a ${formatoFecha(datos.primeraFecha)}`)
  }
  if (!cambios.length) return actual // no hubo cambios: no se guarda ni se anota nada
  publicar({
    ...estado,
    prestamos: estado.prestamos.map((p) => (p.id === id ? prestamo : p)),
    recibos: [...estado.recibos.filter((r) => r.prestamoId !== id), ...nuevas],
    historial: anotar(estado.historial, 'editar', `Editó el préstamo de ${entidad}: cambió ${cambios.join('; ')}`),
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
