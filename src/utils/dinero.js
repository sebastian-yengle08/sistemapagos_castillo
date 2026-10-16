// Formato de moneda peruana: S/ 1,250.00
export function formatoSoles(n) {
  const v = Number(n) || 0
  return 'S/ ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Convierte lo que escribe el usuario ("1,250.5") en número; NaN si no es válido. */
export function leerMonto(texto) {
  const limpio = String(texto ?? '').replace(/[\s,]/g, '')
  if (!/^(\d+\.?\d*|\.\d+)$/.test(limpio)) return NaN
  return Math.round(parseFloat(limpio) * 100) / 100
}
