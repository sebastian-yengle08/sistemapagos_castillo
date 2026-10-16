// HU-08: nuevo préstamo con vista previa de cuotas (gerente). No se calculan intereses.
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Boton, Campo, Tarjeta, claseInput } from '../components/ui'
import { calcularCuotas, crearPrestamo } from '../data/store'
import { formatoFecha, hoyISO } from '../utils/fechas'
import { formatoSoles, leerMonto } from '../utils/dinero'

export default function PrestamoNuevoPage() {
  const navegar = useNavigate()
  const [entidad, setEntidad] = useState('')
  const [total, setTotal] = useState('')
  const [num, setNum] = useState('')
  const [cuota, setCuota] = useState('')
  const [primera, setPrimera] = useState(hoyISO())
  const [errores, setErrores] = useState({})

  const nCuotas = Number(num)
  const mCuota = leerMonto(cuota)
  const cuotasOk = Number.isInteger(nCuotas) && nCuotas >= 1 && nCuotas <= 120 && mCuota > 0 && !!primera

  // La vista previa se actualiza sola mientras se llenan los datos
  const vista = useMemo(() => (cuotasOk ? calcularCuotas({ numCuotas: nCuotas, montoCuota: mCuota, primeraFecha: primera }) : []), [cuotasOk, nCuotas, mCuota, primera])

  function guardar(e) {
    e.preventDefault()
    const er = {}
    if (!entidad.trim()) er.entidad = 'Escribe el banco o la entidad.'
    if (!(leerMonto(total) > 0)) er.total = 'Escribe el monto total del préstamo.'
    if (!(Number.isInteger(nCuotas) && nCuotas >= 1 && nCuotas <= 120)) er.num = 'Escribe cuántas cuotas son (de 1 a 120).'
    if (!(mCuota > 0)) er.cuota = 'Escribe el monto de cada cuota.'
    if (!primera) er.primera = 'Elige la fecha de la primera cuota.'
    setErrores(er)
    if (Object.keys(er).length) return
    const p = crearPrestamo({ entidad, montoTotal: leerMonto(total), numCuotas: nCuotas, montoCuota: mCuota, primeraFecha: primera })
    navegar(`/prestamos/${p.id}`, { state: { aviso: 'Préstamo guardado y cuotas creadas' } })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/prestamos" className="mb-3 inline-flex min-h-12 items-center gap-1 font-semibold text-brand">
        <ArrowLeft size={20} aria-hidden="true" /> Volver
      </Link>
      <h1 className="text-2xl font-bold sm:text-3xl">Nuevo préstamo</h1>
      <p className="mt-1 text-suave">Escribe la cuota tal como la cobra el banco: el sistema no calcula intereses.</p>

      <form noValidate onSubmit={guardar} className="mt-5 flex flex-col gap-5 rounded-2xl border border-borde bg-white p-4 sm:p-6">
        <Campo etiqueta="Banco o entidad" id="p-ent" error={errores.entidad}>
          <input id="p-ent" value={entidad} onChange={(e) => setEntidad(e.target.value)} placeholder="Ej.: Banco de Crédito" className={claseInput(errores.entidad)} />
        </Campo>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta="Monto total del préstamo" id="p-tot" error={errores.total}>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-suave">S/</span>
              <input id="p-tot" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0.00" className={`${claseInput(errores.total)} pl-11`} />
            </div>
          </Campo>
          <Campo etiqueta="Número de cuotas" id="p-num" error={errores.num}>
            <input id="p-num" inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))} placeholder="Ej.: 12" className={claseInput(errores.num)} />
          </Campo>
          <Campo etiqueta="Monto de cada cuota" id="p-cuo" error={errores.cuota}>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-suave">S/</span>
              <input id="p-cuo" inputMode="decimal" value={cuota} onChange={(e) => setCuota(e.target.value)} placeholder="0.00" className={`${claseInput(errores.cuota)} pl-11`} />
            </div>
          </Campo>
          <Campo etiqueta="Fecha de la primera cuota" id="p-fec" error={errores.primera}>
            <input id="p-fec" type="date" value={primera} onChange={(e) => setPrimera(e.target.value)} className={claseInput(errores.primera)} />
          </Campo>
        </div>

        {/* Vista previa de las cuotas que se crearán */}
        <section aria-labelledby="vp">
          <h2 id="vp" className="text-lg font-bold">
            Vista previa de cuotas
          </h2>
          {vista.length === 0 ? (
            <p className="mt-2 rounded-xl bg-slate-50 p-4 text-suave">Llena el número de cuotas, el monto y la fecha de la primera cuota para ver aquí cómo quedarán.</p>
          ) : (
            <Tarjeta className="mt-2 max-h-72 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-brand/5 text-sm text-suave">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Cuota</th>
                    <th className="px-4 py-2 font-semibold">Vence</th>
                    <th className="px-4 py-2 text-right font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {vista.map((c) => (
                    <tr key={c.numero} className="border-t border-borde">
                      <td className="px-4 py-2 font-semibold">
                        {c.numero} de {vista.length}
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
          <Boton onClick={() => navegar('/prestamos')}>Cancelar</Boton>
          <Boton variante="primario" type="submit" className="sm:min-w-56">
            Guardar préstamo
          </Boton>
        </div>
      </form>
    </div>
  )
}
