import { diasEntre, partes } from './fechas'

/**
 * Agrupa los recibos no pagados en los avisos. Cada recibo cae en UN solo grupo,
 * en este orden de prioridad: Vence hoy, Vence en 3 días, Vencidos, Pendientes del mes.
 */
export function agruparAvisos(recibos, hoy) {
  const g = { hoy: [], tresDias: [], vencidos: [], mes: [] }
  const h = partes(hoy)
  for (const r of recibos) {
    if (r.estado === 'Pagado') continue
    const d = diasEntre(hoy, r.fechaLimite)
    if (d === 0) g.hoy.push(r)
    else if (d >= 1 && d <= 3) g.tresDias.push(r)
    else if (d < 0) g.vencidos.push(r)
    else {
      const f = partes(r.fechaLimite)
      if (f.a === h.a && f.m === h.m) g.mes.push(r)
    }
  }
  const porFecha = (a, b) => (a.fechaLimite < b.fechaLimite ? -1 : a.fechaLimite > b.fechaLimite ? 1 : 0)
  Object.values(g).forEach((l) => l.sort(porFecha))
  g.total = g.hoy.length + g.tresDias.length + g.vencidos.length + g.mes.length
  return g
}
