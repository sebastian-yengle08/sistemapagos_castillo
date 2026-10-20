// HU-08: nuevo préstamo o edición de un préstamo (solo asistente), con vista previa de cuotas.
// El sistema no calcula intereses: el monto total es siempre (número de cuotas × monto de cada cuota).
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Landmark } from 'lucide-react'
import { Boton, Campo, Insignia, Tarjeta, Vacio, claseInput } from '../components/ui'
import { calcularCuotas, crearPrestamo, editarPrestamo, obtenerPrestamo, planEdicionPrestamo } from '../data/store'
import { LIMITE_PRESTAMO, LIMITE_CUOTA, MAX_CUOTAS } from '../config/constantes'
import { formatoFecha, hoyISO, FECHA_MINIMA, FECHA_MAXIMA, fechaEnRango } from '../utils/fechas'
import { formatoSoles, leerMonto } from '../utils/dinero'
import { soloLetras, soloMontoCuota } from '../utils/validacion'

export default function PrestamoFormPage() {
  const { id } = useParams()
  const editando = !!id
  const navegar = useNavigate()
  const hoy = hoyISO() // fecha de hoy en Lima
  const fechaMinima = FECHA_MINIMA // 1 de enero de 2026
  const fechaMaxima = FECHA_MAXIMA // 31 de diciembre de 2050
  const [original] = useState(() => (id ? obtenerPrestamo(id) : null))

  const [entidad, setEntidad] = useState(original?.entidad ?? '')
  const [num, setNum] = useState(original ? String(original.numCuotas) : '')
  const [cuota, setCuota] = useState(original ? original.montoCuota.toFixed(2) : '')
  const [primera, setPrimera] = useState(() => (fechaEnRango(original?.primeraFecha) ? original.primeraFecha : hoy))
  const [errores, setErrores] = useState({})

  const nCuotas = Number(num)
  const mCuota = leerMonto(cuota)
  const cuotasOk = Number.isInteger(nCuotas) && nCuotas >= 1 && nCuotas <= MAX_CUOTAS && mCuota > 0 && mCuota <= LIMITE_CUOTA && !!primera && primera >= fechaMinima && primera <= fechaMaxima

  // Vista previa de cuotas (al editar, las ya pagadas se muestran como Pagado y no cambian)
  const plan = useMemo(() => {
    if (!cuotasOk) return { cuotas: [], minimoCuotas: 0 }
    if (editando && original) return planEdicionPrestamo(id, { numCuotas: nCuotas, montoCuota: mCuota, primeraFecha: primera })
    return { cuotas: calcularCuotas({ numCuotas: nCuotas, montoCuota: mCuota, primeraFecha: primera }), minimoCuotas: 0 }
  }, [cuotasOk, editando, original, id, nCuotas, mCuota, primera])
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

  const volverA = editando ? `/prestamos/${id}` : '/prestamos'

  function guardar(e) {
    e.preventDefault()
    const er = {}
    if (!entidad.trim()) er.entidad = 'Escribe el banco o la entidad.'
    if (!(Number.isInteger(nCuotas) && nCuotas >= 1 && nCuotas <= MAX_CUOTAS)) er.num = `Escribe cuántas cuotas son (de 1 a ${MAX_CUOTAS}).`
    else if (editando && cuotasOk && nCuotas < plan.minimoCuotas) er.num = `Ya hay cuotas pagadas hasta la ${plan.minimoCuotas}: no puede haber menos.`
    if (!(mCuota > 0)) er.cuota = 'Escribe el monto de cada cuota.'
    else if (mCuota > LIMITE_CUOTA) er.cuota = 'El monto de cada cuota no puede superar los 10 dígitos.'
    if (!primera) er.primera = 'Elige la fecha de la primera cuota.'
    else if (primera < fechaMinima) er.primera = 'La fecha de la primera cuota debe ser desde el 1 de enero de 2026.'
    else if (primera > fechaMaxima) er.primera = 'La fecha de la primera cuota no puede ser posterior al 31 de diciembre de 2050.'
    if (montoTotal > LIMITE_PRESTAMO) er.cuota = `El monto total del préstamo no puede superar S/ ${formatoSoles(LIMITE_PRESTAMO)}.`
    setErrores(er)
    if (Object.keys(er).length) return
    const datos = { entidad, montoTotal, numCuotas: nCuotas, montoCuota: mCuota, primeraFecha: primera }
    const p = editando ? editarPrestamo(id, datos) : crearPrestamo(datos)
    if (!p) return setErrores((x) => ({ ...x, primera: 'La fecha de la primera cuota debe estar entre el 1 de enero de 2026 y el 31 de diciembre de 2050.' }))
    navegar(`/prestamos/${p.id}`, { replace: true, state: { aviso: editando ? 'Cambios del préstamo guardados' : 'Préstamo guardado y cuotas creadas' } })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={volverA} replace className="mb-3 inline-flex min-h-12 items-center gap-1 font-semibold text-brand">
        <ArrowLeft size={20} aria-hidden="true" /> Volver
      </Link>
      <h1 className="text-2xl font-bold sm:text-3xl">{editando ? 'Editar préstamo' : 'Nuevo préstamo'}</h1>
      <p className="mt-1 text-suave">Escribe la cuota tal como la cobra el banco: el sistema no calcula intereses, solo suma las cuotas para obtener el monto total. La mora o interés se agrega al registrar cada pago.</p>
      {editando && <p className="mt-2 rounded-xl bg-pend-bg px-4 py-2 text-sm font-semibold text-pend-tx">Las cuotas ya pagadas no cambian. Los cambios se aplican a las cuotas que faltan pagar.</p>}

      <form noValidate onSubmit={guardar} className="mt-5 flex flex-col gap-5 rounded-2xl border border-borde bg-sup p-4 sm:p-6">
        <Campo etiqueta="Banco o entidad" id="p-ent" error={errores.entidad}>
          <input id="p-ent" value={entidad} onChange={(e) => setEntidad(soloLetras(e.target.value))} placeholder="Ej.: Banco de Crédito" className={claseInput(errores.entidad)} />
        </Campo>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta="Número de cuotas" id="p-num" error={errores.num} ayuda={`De 1 a ${MAX_CUOTAS} cuotas.`}>
            <input
              id="p-num"
              inputMode="numeric"
              value={num}
              onChange={(e) => {
                const digitos = e.target.value.replace(/\D/g, '')
                setNum(digitos === '' ? '' : String(Math.min(Number(digitos), MAX_CUOTAS)))
              }}
              placeholder="Ej.: 12"
              className={claseInput(errores.num)}
            />
          </Campo>
          <Campo etiqueta="Monto de cada cuota" id="p-cuo" error={errores.cuota} ayuda="Máximo 10 dígitos.">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-suave">S/</span>
              <input id="p-cuo" inputMode="decimal" value={cuota} onChange={(e) => setCuota(soloMontoCuota(e.target.value))} placeholder="0.00" className={`${claseInput(errores.cuota)} pl-11`} />
            </div>
          </Campo>
          <Campo etiqueta="Fecha de la primera cuota" id="p-fec" error={errores.primera}>
            <input id="p-fec" type="date" min={fechaMinima} max={fechaMaxima} value={primera} onChange={(e) => setPrimera(e.target.value)} className={claseInput(errores.primera)} />
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
