/** Texto del resumen de avisos (a partir de los grupos de agruparAvisos). null si no hay nada que avisar. */
export function resumenAvisos(g) {
  const partes = []
  if (g.hoy.length) partes.push(`Vence hoy: ${g.hoy.length}`)
  if (g.tresDias.length) partes.push(`En 3 días: ${g.tresDias.length}`)
  if (g.vencidos.length) partes.push(`Vencidos: ${g.vencidos.length}`)
  return partes.length ? partes.join(' · ') : null
}
