// Cálculos de mora/interés y total pagado de las cuotas de préstamo.

/**
 * Mora o interés de un pago. Los pagos antiguos no tienen el campo `interes`:
 * en ese caso se toma como interés el excedente sobre el monto de la cuota.
 */
export function interesDePago(pago, montoCuota) {
  if (!pago) return 0
  if (pago.interes != null) return Math.max(0, Number(pago.interes) || 0)
  const diferencia = (Number(pago.monto) || 0) - (Number(montoCuota) || 0)
  return Math.max(0, Math.round(diferencia * 100) / 100)
}

/** Mora o interés registrado en una cuota. */
export function interesCuota(recibo) {
  return interesDePago(recibo?.pago, recibo?.monto)
}

/** Total pagado de una cuota: el pago real si ya está pagada; si no, monto + interés. */
export function totalPagoCuota(recibo) {
  const monto = Number(recibo?.monto) || 0
  if (recibo?.pago) return Number(recibo.pago.monto) || monto
  return Math.round((monto + interesCuota(recibo)) * 100) / 100
}
