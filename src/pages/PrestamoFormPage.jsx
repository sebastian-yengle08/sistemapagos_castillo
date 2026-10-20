// HU-08: nuevo préstamo o edición de un préstamo (solo asistente), con vista previa de cuotas.
// El sistema no calcula intereses: el monto total es siempre (número de cuotas × monto de cada cuota).
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Landmark } from 'lucide-react'
import { Boton, Campo, Insignia, Tarjeta, Vacio, claseInput } from '../components/ui'
import { calcularCuotas, crearPrestamo, editarPrestamo, motivoRechazo, obtenerPrestamo, planEdicionPrestamo } from '../data/store'
import { useDatos } from '../data/useDatos'
import { LIMITE_PRESTAMO, LIMITE_CUOTA, MAX_CUOTAS, NOMBRE_MIN, NOMBRE_MAX } from '../config/constantes'
import { formatoFecha, hoyISO, fechaMaxima } from '../utils/fechas'
import { formatoSoles, leerMonto } from '../utils/dinero'
import { limpiarNombre, soloLetras, soloMontoCuota } from '../utils/validacion'

export default function PrestamoFormPage() {
  const { id } = useParams()
  const editando = !!id
  const navegar = useNavigate()
  const hoy = hoyISO() // fecha de hoy en Lima
  // Una fecha nueva de cuota no puede ser anterior a hoy. Si al editar una cuota ya vencida
  // no se cambia su fecha, se conserva para no bloquear los demás cambios del préstamo.
  const fechaMinima = hoy
  const fechaMax = fechaMaxima() // hoy + 24 años
  const [original] = useState(() => (id ? obtenerPrestamo(id) : null))
  const { recibos } = useDatos()

  const [entidad, setEntidad] = useState(original?.entidad ?? '')
  const [num, setNum] = useState(original ? String(original.numCuotas) : '')
  const [cuota, setCuota] = useState(original ? original.montoCuota.toFixed(2) : '')
  const [errores, setErrores] = useState({})
  const [primeraManual, setPrimeraManual] = useState(null) // null = usar la fecha calculada de la primera cuota pendiente

  const cuotasPrestamo = editando ? recibos.filter((r) => r.prestamoId === id) : []
  const hayPagos = cuotasPrestamo.some((r) => r.estado === 'Pagado')
  const todasPagadas = cuotasPrestamo.length > 0 && cuotasPrestamo.every((r) => r.estado === 'Pagado')
  const cuotaBloqueada = editando && hayPagos
  const primeraPendiente = editando
    ? [...cuotasPrestamo].filter((r) => r.estado !== 'Pagado').sort((a, b) => a.cuota - b.cuota)[0] ?? null
    : null
  // Al editar, la fecha que se cambia es la de la primera cuota pendiente (o la primera si aún no hay pagos).
  const fechaBase = editando ? (primeraPendiente?.fechaLimite ?? original?.primeraFecha ?? hoy) : hoy
  const primera = primeraManual ?? fechaBase
  const etiquetaFecha = primeraPendiente && primeraPendiente.cuota > 1 ? `Fecha de la cuota ${primeraPendiente.cuota}` : 'Fecha de la primera cuota'
  const fechaPendienteActual = primeraPendiente?.fechaLimite ?? null
  const fechaEsLaActual = editando && !!fechaPendienteActual && primera === fechaPendienteActual
  const fechaVencidaSinCambios = editando && !!fechaPendienteActual && fechaPendienteActual < hoy && fechaEsLaActual
  const fechaOk = todasPagadas || (!!primera && primera <= fechaMax && (primera >= fechaMinima || fechaEsLaActual))

  const nCuotas = Number(num)
  const mCuota = leerMonto(cuota)
  // Si ya hay cuotas pagadas, el monto de la cuota queda bloqueado.
  const montoCuotaEfectivo = cuotaBloqueada ? (original?.montoCuota ?? 0) : mCuota
  const cuotasOk = Number.isInteger(nCuotas) && nCuotas >= 1 && nCuotas <= MAX_CUOTAS && montoCuotaEfectivo > 0 && montoCuotaEfectivo <= LIMITE_CUOTA && fechaOk

  // Vista previa de cuotas (al editar, las ya pagadas se muestran como Pagado y no cambian)
  const plan = useMemo(() => {
    if (!cuotasOk) return { cuotas: [], minimoCuotas: 0 }
    if (editando && original) return planEdicionPrestamo(id, { numCuotas: nCuotas, montoCuota: montoCuotaEfectivo, primeraFecha: primera })
    return { cuotas: calcularCuotas({ numCuotas: nCuotas, montoCuota: montoCuotaEfectivo, primeraFecha: primera }), minimoCuotas: 0 }
  }, [cuotasOk, editando, original, id, nCuotas, montoCuotaEfectivo, primera, recibos])
  const montoTotal = Math.round(plan.cuotas.reduce((t, c) => t + c.monto, 0) * 100) / 100

  if (editando && !original) {
    return (
      <Vacio icono={Landmark} titulo="No encontramos este préstamo">
        <Link to="/prestamos" replace className="mt-3 inline-flex min-h-12 items-center rounded-full bg-brand px-5 font-semibold text-white">
          Ver préstamos
        </Link>
      </Vacio>
    )
  }

  // Fecha de la última cuota: no puede pasar del rango permitido (hoy + 24 años)
  const ultimaFecha = plan.cuotas[plan.cuotas.length - 1]?.fechaLimite
  const volverA = editando ? `/prestamos/${id}` : '/prestamos'

  function guardar(e) {
    e.preventDefault()
    const er = {}
    const nombreBanco = limpiarNombre(entidad)
    const sujetoFecha = primeraPendiente?.cuota > 1 ? `la cuota ${primeraPendiente.cuota}` : 'la primera cuota'
    if (!nombreBanco) er.entidad = 'Escribe el banco o la entidad.'
    else if (nombreBanco.length < NOMBRE_MIN) er.entidad = `El nombre debe tener al menos ${NOMBRE_MIN} caracteres.`
    if (!(Number.isInteger(nCuotas) && nCuotas >= 1 && nCuotas <= MAX_CUOTAS)) er.num = `Escribe cuántas cuotas son (de 1 a ${MAX_CUOTAS}).`
    else if (editando && cuotasOk && nCuotas < plan.minimoCuotas) er.num = `Ya hay cuotas pagadas hasta la ${plan.minimoCuotas}: no puede haber menos.`
    if (cuotasOk && ultimaFecha > fechaMax) {
      const mensaje = `La última cuota caería el ${formatoFecha(ultimaFecha)}, después del ${formatoFecha(fechaMax)}. ${editando ? 'Adelanta la fecha de las cuotas pendientes.' : 'Baja el número de cuotas o adelanta la primera fecha.'}`
      if (editando) er.primera = mensaje
      else er.num = mensaje
    }
    if (!(montoCuotaEfectivo > 0)) er.cuota = 'Escribe el monto de cada cuota.'
    else if (montoCuotaEfectivo > LIMITE_CUOTA) er.cuota = 'El monto de cada cuota no puede superar los 10 dígitos.'
    if (!todasPagadas) {
      if (!primera) er.primera = `Elige la fecha de ${sujetoFecha}.`
      else if (primera < fechaMinima && !fechaEsLaActual) {
        er.primera = editando
          ? `La fecha de ${sujetoFecha} no puede ser anterior a hoy (${formatoFecha(hoy)}).`
          : `La fecha de la primera cuota no puede ser anterior a hoy (${formatoFecha(hoy)}).`
      } else if (primera > fechaMax) er.primera = `La fecha de ${sujetoFecha} no puede ser posterior al ${formatoFecha(fechaMax)}.`
    }
    if (montoTotal > LIMITE_PRESTAMO) er.cuota = `El monto total del préstamo (suma de las cuotas) no puede superar ${formatoSoles(LIMITE_PRESTAMO)}. Baja el monto o el número de cuotas.`
    setErrores(er)
    if (Object.keys(er).length) return
    const datos = { entidad, montoTotal, numCuotas: nCuotas, montoCuota: montoCuotaEfectivo, primeraFecha: primera }
    const p = editando ? editarPrestamo(id, datos) : crearPrestamo(datos)
    if (!p) {
      // El store rechazó el guardado: se muestra el motivo real, junto al campo que corresponde
      const r = motivoRechazo()
      return setErrores({ [r.campo]: r.mensaje })
    }
    navegar(`/prestamos/${p.id}`, { replace: true, state: { aviso: editando ? 'Cambios del préstamo guardados' : 'Préstamo guardado y cuotas creadas' } })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={volverA} replace className="mb-3 inline-flex min-h-12 items-center gap-1 font-semibold text-brand">
        <ArrowLeft size={20} aria-hidden="true" /> Volver
      </Link>
      <h1 className="text-2xl font-bold sm:text-3xl">{editando ? 'Editar préstamo' : 'Nuevo préstamo'}</h1>
      <p className="mt-1 text-suave">Escribe la cuota tal como la cobra el banco: el sistema no calcula intereses, solo suma las cuotas para obtener el monto total. La mora o interés se agrega al registrar cada pago.</p>
      {editando && (
        <p className={`mt-2 rounded-xl px-4 py-2 text-sm font-semibold ${hayPagos ? 'bg-pend-bg text-pend-tx' : 'bg-brand/10 text-brand'}`}>
          {todasPagadas
            ? 'Todas las cuotas están pagadas. El monto de cada cuota ya no se puede cambiar.'
            : hayPagos
              ? 'Este préstamo ya tiene cuotas pagadas: el monto de cada cuota está bloqueado. Puedes cambiar los demás datos.'
              : 'Aún no hay cuotas pagadas: puedes editar el monto de cada cuota.'}
        </p>
      )}

      <form noValidate onSubmit={guardar} className="mt-5 flex flex-col gap-5 rounded-2xl border border-borde bg-sup p-4 sm:p-6">
        <Campo etiqueta="Banco o entidad" id="p-ent" error={errores.entidad}>
          <input id="p-ent" maxLength={NOMBRE_MAX} value={entidad} onChange={(e) => setEntidad(soloLetras(e.target.value))} placeholder="Ej.: Banco de Crédito" className={claseInput(errores.entidad)} />
        </Campo>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta="Número de cuotas" id="p-num" error={errores.num} ayuda={editando ? 'El número de cuotas no se puede cambiar al editar un préstamo.' : `De 1 a ${MAX_CUOTAS} cuotas.`}>
            <input
              id="p-num"
              inputMode="numeric"
              value={num}
              onChange={(e) => {
                if (editando) return
                const digitos = e.target.value.replace(/\D/g, '')
                setNum(digitos === '' ? '' : String(Math.min(Number(digitos), MAX_CUOTAS)))
              }}
              disabled={editando}
              placeholder="Ej.: 12"
              className={`${claseInput(errores.num)} disabled:cursor-not-allowed disabled:bg-slate-900/[.05] disabled:text-suave`}
            />
          </Campo>
          <Campo etiqueta="Monto de cada cuota" id="p-cuo" error={errores.cuota} ayuda={cuotaBloqueada ? 'Bloqueado: ya hay cuotas pagadas. Solo se puede cambiar si no hay ningún pago.' : 'Máximo 10 dígitos. Se aplica a las cuotas pendientes.'}>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-suave">S/</span>
              <input
                id="p-cuo"
                autoComplete="new-password"
                inputMode="decimal"
                value={cuotaBloqueada ? (original?.montoCuota ?? 0).toFixed(2) : cuota}
                onChange={(e) => setCuota(soloMontoCuota(e.target.value))}
                disabled={cuotaBloqueada}
                placeholder="0.00"
                className={`${claseInput(errores.cuota)} pl-11 disabled:cursor-not-allowed disabled:bg-slate-900/[.05] disabled:text-suave`}
              />
            </div>
          </Campo>
          <Campo
            etiqueta={etiquetaFecha}
            id="p-fec"
            error={errores.primera}
            ayuda={
              todasPagadas
                ? 'Todas las cuotas están pagadas.'
                : fechaVencidaSinCambios
                  ? 'La cuota ya está vencida. Si cambias la fecha, debe ser hoy o después.'
                  : primeraPendiente && primeraPendiente.cuota > 1
                    ? 'Debe ser hoy o una fecha futura. Las cuotas pendientes se reprograman desde esta fecha.'
                    : 'Debe ser hoy o una fecha futura.'
            }
          >
            <input
              id="p-fec"
              type="date"
              min={fechaMinima}
              max={fechaMax}
              value={primera}
              onChange={(e) => setPrimeraManual(e.target.value)}
              disabled={todasPagadas}
              className={`${claseInput(errores.primera)} disabled:cursor-not-allowed disabled:bg-slate-900/[.05] disabled:text-suave`}
            />
          </Campo>
        </div>

        {/* Monto total calculado automáticamente */}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-brand/10 px-4 py-3" aria-live="polite">
          <div>
            <p className="font-semibold">Monto total del préstamo</p>
            <p className="text-sm text-suave">{montoTotal > 0 ? `${plan.cuotas.length} cuotas` : 'Se calcula con el número de cuotas y el monto de cada cuota'}</p>
          </div>
          <p className="text-2xl font-bold text-brand">{formatoSoles(montoTotal)}</p>
        </div>

        {/* Vista previa de las cuotas */}
        <section aria-labelledby="vp">
          <h2 id="vp" className="text-lg font-bold">
            Vista previa de cuotas
          </h2>
          {plan.cuotas.length === 0 ? (
            <p className="mt-2 rounded-xl bg-slate-900/[.04] p-4 text-suave">Llena el número de cuotas, el monto y la fecha de la primera cuota para ver aquí cómo quedarán.</p>
          ) : (
            <Tarjeta className="mt-2 max-h-72 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-100 text-sm text-suave">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Cuota</th>
                    <th className="px-4 py-2 font-semibold">Vence</th>
                    <th className="px-4 py-2 text-right font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.cuotas.map((c) => (
                    <tr key={c.numero} className="border-t border-borde">
                      <td className="px-4 py-2 font-semibold">
                        {c.numero} de {plan.cuotas.length}
                        {c.pagada && (
                          <span className="ml-2 align-middle">
                            <Insignia estado="Pagado" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">{formatoFecha(c.fechaLimite)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{formatoSoles(c.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
          )}
        </section>

        {errores.general && (
          <p role="alert" className="rounded-xl border border-venc-bd bg-venc-bg px-4 py-3 font-semibold text-venc-tx">
            {errores.general}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Boton onClick={() => navegar(volverA, { replace: true })}>Cancelar</Boton>
          <Boton variante="primario" type="submit" className="sm:min-w-56">
            {editando ? 'Guardar cambios' : 'Guardar préstamo'}
          </Boton>
        </div>
      </form>
    </div>
  )
}
