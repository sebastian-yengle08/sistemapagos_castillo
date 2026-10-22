// Guarda y lee los datos en Supabase. Solo lo usa store.js.
// Si no hay variables VITE_SUPABASE_*, la app sigue funcionando solo con localStorage.
import { createClient } from '@supabase/supabase-js'
import { blobADataUrl } from '../utils/imagen'

const URL = import.meta.env.VITE_SUPABASE_URL
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hayNube = !!(URL && CLAVE)
const nube = hayNube ? createClient(URL, CLAVE, { auth: { persistSession: false } }) : null

const iso = (t) => (t ? new Date(t).toISOString() : t)

// ── Control de versiones ────────────────────────────────────────────────────
// Cada fila de recibos y préstamos tiene una columna `version` que la base sube sola en cada cambio.
// Al guardar, la app dice "cambia esta fila SOLO si sigue en la versión que yo vi". Si otro dispositivo
// ya la cambió, el guardado se rechaza (Conflicto) en lugar de pisar su trabajo con datos viejos.
// Si la columna todavía no existe en la base, todo sigue funcionando como antes (sin esta protección).
export class Conflicto extends Error {
  constructor(mensaje) {
    super(mensaje)
    this.conflicto = true
  }
}
let versiones = { recibos: new Map(), prestamos: new Map() } // versión que esta pantalla conoce de cada fila
let usaVersion = { recibos: false, prestamos: false }

/** Da por vista una lectura de la base: desde aquí se guarda comparando contra estas versiones. */
export function confirmarVersiones(lectura) {
  const v = lectura?._versiones
  if (!v) return
  versiones = v.nuevas
  usaVersion = v.activa
}

// ── Conversión entre la forma de la app (camelCase) y las tablas (snake_case) ──
const mapas = {
  recibos: {
    aFila: (r) => ({
      id: r.id, tipo: r.tipo, empresa: r.empresa, codigo: r.codigo, fecha_limite: r.fechaLimite, monto: r.monto,
      estado: r.estado, pago: r.pago ?? null, prestamo_id: r.prestamoId ?? null, cuota: r.cuota ?? null, creado_en: r.creadoEn,
      // Solo se envía si hay titular: mientras la base no tenga la columna, nada más se rompe
      ...(r.titular !== undefined ? { titular: r.titular } : {}),
    }),
    deFila: (f) => ({
      id: f.id, tipo: f.tipo, empresa: f.empresa, codigo: f.codigo, fechaLimite: f.fecha_limite, monto: Number(f.monto),
      estado: f.estado, pago: f.pago ?? null, prestamoId: f.prestamo_id ?? null, cuota: f.cuota ?? null, creadoEn: iso(f.creado_en),
      ...(f.titular != null ? { titular: f.titular } : {}),
    }),
  },
  prestamos: {
    aFila: (p) => ({
      id: p.id, entidad: p.entidad, monto_total: p.montoTotal, num_cuotas: p.numCuotas, monto_cuota: p.montoCuota,
      primera_fecha: p.primeraFecha, correlativo: p.correlativo, creado_en: p.creadoEn,
      ...(p.titular !== undefined ? { titular: p.titular } : {}),
    }),
    deFila: (f) => ({
      id: f.id, entidad: f.entidad, montoTotal: Number(f.monto_total), numCuotas: f.num_cuotas, montoCuota: Number(f.monto_cuota),
      primeraFecha: f.primera_fecha, correlativo: f.correlativo, creadoEn: iso(f.creado_en),
      ...(f.titular != null ? { titular: f.titular } : {}),
    }),
  },
  historial: {
    // Sin `ts`, la base usa su propia hora (now()): así el orden no depende del reloj de cada dispositivo.
    aFila: (h) => ({ id: h.id, ...(h.tsFijo ? { ts: h.ts } : {}), perfil: h.perfil, accion: h.accion, texto: h.texto }),
    deFila: (f) => ({ id: f.id, ts: iso(f.ts), perfil: f.perfil, accion: f.accion, texto: f.texto }),
  },
}
// Orden para respetar la llave foránea: primero préstamos, luego recibos.
const TABLAS = ['prestamos', 'recibos', 'historial']

/** Lee una tabla completa de a 1000 filas (Supabase no entrega más por consulta; sin esto se cortaba en silencio). */
async function leerTabla(t) {
  const filas = []
  for (let desde = 0; desde < 500000; desde += 1000) {
    const { data, error } = await nube.from(t).select('*').order('id').range(desde, desde + 999)
    if (error) throw new Error(`${t}: ${error.message}`)
    filas.push(...data)
    if (data.length < 1000) break
  }
  return filas
}

/** Lee todo desde Supabase. Lanza error si falla (por ejemplo, tablas sin crear). */
export async function leerNube() {
  const salida = {}
  const nuevas = { recibos: new Map(), prestamos: new Map() }
  const activa = { ...usaVersion }
  for (const t of TABLAS) {
    const data = await leerTabla(t)
    salida[t] = data.map(mapas[t].deFila)
    if (nuevas[t]) {
      if (data.length) activa[t] = 'version' in data[0]
      data.forEach((f) => nuevas[t].set(f.id, f.version))
    }
  }
  // Las versiones no se aplican solas: store.js las confirma (confirmarVersiones) solo cuando usa esta lectura
  Object.defineProperty(salida, '_versiones', { value: { nuevas, activa }, enumerable: false })
  return salida
}

/**
 * Aplica a Supabase solo lo que cambió entre dos versiones de los datos.
 * Lanza Conflicto si otro dispositivo cambió (o borró) la misma fila mientras tanto.
 */
export async function sincronizarNube(previo, nuevo) {
  const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const cambios = {}
  for (const t of TABLAS) {
    const antes = new Map(previo[t].map((x) => [x.id, x]))
    const ahora = new Map(nuevo[t].map((x) => [x.id, x]))
    cambios[t] = {
      nuevos: nuevo[t].filter((x) => !antes.has(x.id)),
      editados: nuevo[t].filter((x) => antes.has(x.id) && !mismo(antes.get(x.id), x)),
      borrar: previo[t].filter((x) => !ahora.has(x.id)).map((x) => x.id),
    }
  }
  const choque = (t, id) => new Conflicto(`${t}: la fila ${id} cambió o ya no existe`)

  // Primero se borra (recibos antes que préstamos)
  for (const t of [...TABLAS].reverse()) {
    for (const id of cambios[t].borrar) {
      const v = versiones[t]?.get(id)
      const protegido = usaVersion[t] && v != null
      let q = nube.from(t).delete().eq('id', id)
      if (protegido) q = q.eq('version', v)
      const { data, error } = await q.select('id')
      if (error) throw new Error(`${t}: ${error.message}`)
      if (protegido && data.length === 0) throw choque(t, id)
      versiones[t]?.delete(id)
    }
  }

  // Luego se sube (préstamos antes que recibos)
  for (const t of TABLAS) {
    const { nuevos, editados } = cambios[t]
    if (t === 'historial') {
      // El historial solo se agrega: nunca se edita
      if (nuevos.length) {
        const { error } = await nube.from(t).upsert(nuevos.map(mapas[t].aFila))
        if (error) throw new Error(`${t}: ${error.message}`)
      }
      continue
    }
    if (nuevos.length) {
      const { error } = await nube.from(t).insert(nuevos.map(mapas[t].aFila))
      if (error) {
        if (error.code === '23505') throw new Conflicto(`${t}: ya existe (${error.message})`) // índice único: se registró en otro dispositivo
        throw new Error(`${t}: ${error.message}`)
      }
      nuevos.forEach((x) => versiones[t].set(x.id, 0))
    }
    for (const x of editados) {
      const fila = mapas[t].aFila(x)
      const v = versiones[t].get(x.id)
      const protegido = usaVersion[t] && v != null
      if (!protegido) {
        const { error } = await nube.from(t).upsert(fila) // sin columna de versión: como antes
        if (error) throw new Error(`${t}: ${error.message}`)
        continue
      }
      delete fila.id
      const { data, error } = await nube.from(t).update(fila).eq('id', x.id).eq('version', v).select('id,version')
      if (error) {
        if (error.code === '23505') throw new Conflicto(`${t}: ${error.message}`)
        throw new Error(`${t}: ${error.message}`)
      }
      if (data.length === 0) throw choque(t, x.id)
      versiones[t].set(x.id, data[0].version)
    }
  }
}

let canalTiempoReal = null

/** Avisa (callback) cada vez que alguien cambia datos en Supabase, desde cualquier dispositivo. */
export function suscribirCambios(alCambiar) {
  if (!nube) return
  // Si ya hay una conexión viva no se repite; si se cayó, se crea de nuevo
  if (canalTiempoReal && canalTiempoReal.state === 'joined') return
  if (canalTiempoReal) nube.removeChannel(canalTiempoReal)
  let canal = nube.channel(`pagos-castillo-cambios-${Date.now()}`)
  for (const t of TABLAS) canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, alCambiar)
  canal.subscribe()
  canalTiempoReal = canal
}

// ── Fotos de vouchers ───────────────────────────────────────────────────────
const BUCKET = 'vouchers'

/** true si la dirección de la foto es una del bucket de vouchers (o una imagen guardada en este dispositivo). */
export function urlFotoValida(url) {
  if (typeof url !== 'string') return false
  if (url.startsWith('data:image/')) return true // modo sin Supabase
  return !!URL && url.startsWith(`${URL}/storage/v1/object/public/${BUCKET}/`)
}

/** Sube la foto del voucher. Devuelve { url, path }. Sin Supabase se guarda dentro del navegador. */
export async function subirVoucher(blob) {
  if (!nube) return { url: await blobADataUrl(blob), path: null }
  const path = `${crypto.randomUUID()}.jpg`
  const { error } = await nube.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error) throw new Error(error.message)
  return { url: nube.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path }
}

/** Borra una foto (si falla no pasa nada: queda como archivo sin usar). */
export async function borrarVoucher(path) {
  if (!nube || !path) return
  try {
    await nube.storage.from(BUCKET).remove([path])
  } catch {
    /* ignorar */
  }
}
