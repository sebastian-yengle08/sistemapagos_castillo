// Datos de ejemplo, calculados RELATIVOS A LA FECHA ACTUAL (hoy en Lima) para que
// la demostración siempre se vea viva: hay recibos que vencen hoy, en 3 días,
// vencidos, pagados con varios medios, etc.
import { hoyISO, sumarDias, sumarMeses, partes } from '../utils/fechas'

let contador = 0
const nuevoId = (p) => `${p}_${++contador}`

/** Instante UTC (ISO) de "fecha a las hh:mm hora de Lima" (Lima = UTC-5, sin horario de verano). */
function instante(fechaISO, hh, mm) {
  const { a, m, d } = partes(fechaISO)
  return new Date(Date.UTC(a, m - 1, d, hh + 5, mm)).toISOString()
}

function recibo(hoy, o) {
  const fechaLimite = sumarDias(hoy, o.dias)
  const pagado = !!o.pago
  return {
    id: nuevoId('r'),
    tipo: o.tipo,
    empresa: o.empresa,
    codigo: o.codigo,
    fechaLimite,
    monto: o.monto,
    igv: null,
    estado: pagado ? 'Pagado' : 'Pendiente',
    pago: pagado
      ? {
          monto: o.monto,
          fecha: sumarDias(fechaLimite, -(o.pago.antes ?? 1)),
          medio: o.pago.medio,
        }
      : null,
    prestamoId: null,
    cuota: null,
    creadoEn: instante(sumarDias(fechaLimite, -20), 9, 30),
  }
}

export function crearDatosEjemplo() {
  contador = 0
  const hoy = hoyISO()

  const recibos = [
    // ── Pagados (mes pasado y actual) ──
    recibo(hoy, { tipo: 'Servicio', empresa: 'Hidrandina', codigo: '20250412', monto: 312.4, dias: -35, pago: { medio: 'Visa' } }),
    recibo(hoy, { tipo: 'Servicio', empresa: 'Telefónica', codigo: '77841', monto: 189.9, dias: -28, pago: { medio: 'Mastercard' } }),
    recibo(hoy, { tipo: 'Servicio', empresa: 'SEDALIB', codigo: '55120', monto: 96.5, dias: -33, pago: { medio: 'Efectivo' } }),
    recibo(hoy, { tipo: 'Impuesto', empresa: 'SUNAT', codigo: '0621', monto: 1840, dias: -20, pago: { medio: 'Transferencia' } }),
    recibo(hoy, { tipo: 'Proveedor', empresa: 'Distribuidora San Jorge', codigo: 'F001-0231', monto: 2450, dias: -12, pago: { medio: 'Transferencia' } }),
    recibo(hoy, { tipo: 'Impuesto', empresa: 'Municipalidad de Trujillo', codigo: '202503', monto: 275, dias: -9, pago: { medio: 'Efectivo' } }),
    // ── Vencen hoy y en los próximos 3 días ──
    recibo(hoy, { tipo: 'Servicio', empresa: 'SEDALIB', codigo: '55987', monto: 108.3, dias: 0 }),
    recibo(hoy, { tipo: 'Servicio', empresa: 'Telefónica', codigo: '78502', monto: 189.9, dias: 2 }),
    recibo(hoy, { tipo: 'Servicio', empresa: 'Hidrandina', codigo: '20250518', monto: 342.1, dias: 3 }),
    // ── Vencidos ──
    recibo(hoy, { tipo: 'Proveedor', empresa: 'Distribuidora San Jorge', codigo: 'F001-0307', monto: 1320, dias: -2 }),
    recibo(hoy, { tipo: 'Proveedor', empresa: 'Ferretería El Constructor', codigo: 'B001-8821', monto: 640, dias: -5 }),
    // ── Pendientes más adelante ──
    recibo(hoy, { tipo: 'Impuesto', empresa: 'SUNAT', codigo: '0622', monto: 1925, dias: 9 }),
    recibo(hoy, { tipo: 'Impuesto', empresa: 'Municipalidad de Trujillo', codigo: '202504', monto: 275, dias: 14 }),
    recibo(hoy, { tipo: 'Servicio', empresa: 'SEDALIB', codigo: '56602', monto: 101.8, dias: 33 }),
  ]

  // ── Préstamo de ejemplo: 6 cuotas, las 3 primeras ya pagadas ──
  const primera = sumarDias(sumarMeses(hoy, -3), 8)
  const diaCuota = partes(primera).d
  const prestamo = {
    id: nuevoId('p'),
    entidad: 'Banco de Crédito',
    montoTotal: 12900, // 6 cuotas × S/ 2,150.00
    numCuotas: 6,
    montoCuota: 2150,
    primeraFecha: primera,
    correlativo: 1,
    creadoEn: instante(sumarDias(primera, -3), 11, 0),
  }
  for (let i = 1; i <= 6; i++) {
    const fechaLimite = sumarMeses(primera, i - 1, diaCuota)
    const pagada = i <= 3
    // La tercera cuota pagada incluye mora/interés, como en el ejemplo del banco
    const interes = i === 3 ? 4.59 : 0
    recibos.push({
      id: nuevoId('r'),
      tipo: 'Préstamo',
      empresa: prestamo.entidad,
      codigo: `PRE-0001-C${i}/6`,
      fechaLimite,
      monto: prestamo.montoCuota,
      igv: null,
      estado: pagada ? 'Pagado' : 'Pendiente',
      pago: pagada ? { monto: prestamo.montoCuota + interes, interes, fecha: sumarDias(fechaLimite, -1), medio: 'Transferencia' } : null,
      prestamoId: prestamo.id,
      cuota: i,
      creadoEn: prestamo.creadoEn,
    })
  }

  // ── Historial de ejemplo (de lo más reciente a lo más antiguo se ordena al mostrar) ──
  const h = (dias, hh, mm, perfil, accion, texto) => ({ id: nuevoId('h'), ts: instante(sumarDias(hoy, dias), hh, mm), perfil, accion, texto })
  const historial = [
    h(-1, 9, 5, 'Asistente', 'ingreso', 'Ingresó al sistema'),
    h(-1, 9, 20, 'Asistente', 'pago', 'Registró el pago del recibo de Municipalidad de Trujillo'),
    h(-1, 17, 40, 'Gerente', 'ingreso', 'Ingresó al sistema'),
    h(-2, 10, 15, 'Asistente', 'crear', 'Registró el recibo de Distribuidora San Jorge (Proveedor)'),
    h(-2, 10, 32, 'Asistente', 'editar', 'Editó el monto del recibo de Distribuidora San Jorge'),
    h(-3, 15, 0, 'Asistente', 'prestamo', 'Registró el préstamo de Banco de Crédito'),
    h(-3, 8, 50, 'Asistente', 'crear', 'Registró el recibo de SEDALIB (Servicio)'),
  ]

  return { seq: contador, recibos, prestamos: [prestamo], historial }
}
