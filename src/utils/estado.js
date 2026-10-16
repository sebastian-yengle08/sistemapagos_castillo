import { hoyISO } from './fechas'

/**
 * Estado que se MUESTRA de un recibo. Un recibo Pendiente cuya fecha límite ya
 * pasó es Vencido (se calcula al mostrar, no hay proceso aparte).
 */
export function estadoVisible(recibo, hoy = hoyISO()) {
  if (recibo.estado === 'Pagado') return 'Pagado'
  return recibo.fechaLimite < hoy ? 'Vencido' : 'Pendiente'
}
