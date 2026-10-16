// Función de Vercel: envía a todos los dispositivos suscritos el resumen de avisos del día.
// Vercel la ejecuta sola cada día a las 08:00 (hora de Lima) por el cron de vercel.json.
// También se puede probar a mano:  GET /api/enviar-avisos  con  Authorization: Bearer <CRON_SECRET>
import webpush from 'web-push'
import { agruparAvisos } from '../src/utils/avisos.js'
import { hoyISO } from '../src/utils/fechas.js'
import { resumenAvisos } from '../src/utils/resumen.js'

const URL_DB = process.env.VITE_SUPABASE_URL
const CLAVE_DB = process.env.VITE_SUPABASE_ANON_KEY

const cab = { apikey: CLAVE_DB, Authorization: `Bearer ${CLAVE_DB}` }
const leer = async (ruta) => {
  const r = await fetch(`${URL_DB}/rest/v1/${ruta}`, { headers: cab })
  if (!r.ok) throw new Error(`${ruta}: ${r.status} ${await r.text()}`)
  return r.json()
}

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' })
  }
  try {
    webpush.setVapidDetails('mailto:avisos@pagoscastillo.pe', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)

    const filas = await leer('recibos?select=id,empresa,fecha_limite,estado&estado=neq.Pagado&limit=5000')
    const recibos = filas.map((f) => ({ id: f.id, empresa: f.empresa, fechaLimite: f.fecha_limite, estado: f.estado }))
    const grupos = agruparAvisos(recibos, hoyISO())
    const cuerpo = resumenAvisos(grupos)
    if (!cuerpo) return res.status(200).json({ enviados: 0, motivo: 'Sin avisos hoy' })

    const subs = await leer('suscripciones?select=*')
    const mensaje = JSON.stringify({ titulo: 'Pagos Castillo', cuerpo, url: '/avisos' })
    let enviados = 0
    const caducadas = []
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, mensaje)
          enviados++
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) caducadas.push(s.endpoint)
        }
      }),
    )
    // Se limpian los dispositivos que ya no existen
    for (const endpoint of caducadas) {
      await fetch(`${URL_DB}/rest/v1/suscripciones?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: 'DELETE', headers: cab })
    }
    return res.status(200).json({ enviados, caducadas: caducadas.length, cuerpo })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
