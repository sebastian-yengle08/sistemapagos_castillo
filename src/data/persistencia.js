// Guarda y lee los datos en Supabase. Solo lo usa store.js.
// Si no hay variables VITE_SUPABASE_*, la app sigue funcionando solo con localStorage.
import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hayNube = !!(URL && CLAVE)
const nube = hayNube ? createClient(URL, CLAVE, { auth: { persistSession: false } }) : null

const iso = (t) => (t ? new Date(t).toISOString() : t)

// ── Conversión entre la forma de la app (camelCase) y las tablas (snake_case) ──
const mapas = {
  recibos: {
    aFila: (r) => ({
      id: r.id, tipo: r.tipo, empresa: r.empresa, codigo: r.codigo, fecha_limite: r.fechaLimite, monto: r.monto,
      igv: r.igv ?? null, estado: r.estado, pago: r.pago ?? null, prestamo_id: r.prestamoId ?? null, cuota: r.cuota ?? null, creado_en: r.creadoEn,
    }),
    deFila: (f) => ({
      id: f.id, tipo: f.tipo, empresa: f.empresa, codigo: f.codigo, fechaLimite: f.fecha_limite, monto: Number(f.monto),
      igv: f.igv == null ? null : Number(f.igv), estado: f.estado, pago: f.pago ?? null, prestamoId: f.prestamo_id ?? null, cuota: f.cuota ?? null, creadoEn: iso(f.creado_en),
    }),
  },
  prestamos: {
    aFila: (p) => ({
      id: p.id, entidad: p.entidad, monto_total: p.montoTotal, num_cuotas: p.numCuotas, monto_cuota: p.montoCuota,
      primera_fecha: p.primeraFecha, correlativo: p.correlativo, creado_en: p.creadoEn,
    }),
    deFila: (f) => ({
      id: f.id, entidad: f.entidad, montoTotal: Number(f.monto_total), numCuotas: f.num_cuotas, montoCuota: Number(f.monto_cuota),
      primeraFecha: f.primera_fecha, correlativo: f.correlativo, creadoEn: iso(f.creado_en),
    }),
  },
  historial: {
    aFila: (h) => ({ id: h.id, ts: h.ts, perfil: h.perfil, accion: h.accion, texto: h.texto }),
    deFila: (f) => ({ id: f.id, ts: iso(f.ts), perfil: f.perfil, accion: f.accion, texto: f.texto }),
  },
}
// Orden para respetar la llave foránea: primero préstamos, luego recibos.
const TABLAS = ['prestamos', 'recibos', 'historial']

/** Lee todo desde Supabase. Lanza error si falla (por ejemplo, tablas sin crear). */
export async function leerNube() {
  const salida = {}
  for (const t of TABLAS) {
    const { data, error } = await nube.from(t).select('*').order('id').limit(10000)
    if (error) throw new Error(`${t}: ${error.message}`)
    salida[t] = data.map(mapas[t].deFila)
  }
  return salida
}

/** Aplica a Supabase solo lo que cambió entre dos versiones de los datos. */
export async function sincronizarNube(previo, nuevo) {
  const mismo = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const cambios = {}
  for (const t of TABLAS) {
    const antes = new Map(previo[t].map((x) => [x.id, x]))
    const ahora = new Map(nuevo[t].map((x) => [x.id, x]))
    cambios[t] = {
      subir: nuevo[t].filter((x) => !antes.has(x.id) || !mismo(antes.get(x.id), x)),
      borrar: previo[t].filter((x) => !ahora.has(x.id)).map((x) => x.id),
    }
  }
  // Primero se borra (recibos antes que préstamos) y luego se sube (préstamos antes que recibos)
  for (const t of [...TABLAS].reverse()) {
    const { borrar } = cambios[t]
    if (borrar.length) {
      const { error } = await nube.from(t).delete().in('id', borrar)
      if (error) throw new Error(`${t}: ${error.message}`)
    }
  }
  for (const t of TABLAS) {
    const { subir } = cambios[t]
    if (subir.length) {
      const { error } = await nube.from(t).upsert(subir.map(mapas[t].aFila))
      if (error) throw new Error(`${t}: ${error.message}`)
    }
  }
}

/** Guarda (o actualiza) la suscripción de notificaciones de un dispositivo. */
export async function guardarSuscripcion(sub, perfil) {
  if (!nube) return
  const { error } = await nube.from('suscripciones').upsert({
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    perfil: perfil === 'gerente' ? 'Gerente' : 'Asistente',
  })
  if (error) throw new Error(`suscripciones: ${error.message}`)
}

/** Avisa (callback) cada vez que alguien cambia datos en Supabase, desde cualquier dispositivo. */
export function suscribirCambios(alCambiar) {
  if (!nube) return () => {}
  let canal = nube.channel('pagos-castillo-cambios')
  for (const t of TABLAS) canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, alCambiar)
  canal.subscribe()
  return () => nube.removeChannel(canal)
}
