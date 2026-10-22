// HU-08: detalle de un préstamo, con su tabla de cuotas. El asistente puede editarlo; el gerente solo lo consulta.
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Landmark, Pencil } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useDatos } from '../data/useDatos'
import { resumenPrestamo } from '../data/store'
import { Insignia, Tarjeta, Vacio } from '../components/ui'
import { estadoVisible } from '../utils/estado'
import { formatoFecha, hoyISO } from '../utils/fechas'
import { formatoSoles } from '../utils/dinero'
import { interesCuota, totalPagoCuota } from '../utils/prestamos'

export default function PrestamoDetallePage() {
  const { id } = useParams()
  const { prestamos, recibos } = useDatos()
  const { state } = useLocation()
  const { perfil } = useAuth()
  const p = prestamos.find((x) => x.id === id)
  if (!p) {
    return (
      <Vacio icono={Landmark} titulo="No encontramos este préstamo">
        <Link to="/prestamos" className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-white">
          Ver préstamos
        </Link>
      </Vacio>
    )
  }
  const s = resumenPrestamo(p, recibos)
  const hoy = hoyISO()

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/prestamos" className="mb-3 inline-flex min-h-12 items-center gap-1 font-semibold text-brand">
        <ArrowLeft size={20} aria-hidden="true" /> Volver
      </Link>
      {state?.aviso && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-pag-bd bg-pag-bg px-4 py-3 font-semibold text-pag-tx">
          <CheckCircle2 size={20} aria-hidden="true" /> {state.aviso}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{p.entidad}</h1>
          {p.titular && <p className="mt-1 text-suave">Titular: {p.titular}</p>}
        </div>
        {perfil === 'asistente' && (
          <Link to={`/prestamos/${p.id}/editar`} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-borde bg-slate-900/[.05] px-5 font-semibold hover:bg-slate-900/10">
            <Pencil size={18} aria-hidden="true" /> Editar préstamo
          </Link>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Tarjeta className="p-4">
          <p className="text-sm text-suave">Monto total</p>
          <p className="text-2xl font-bold">{formatoSoles(s.totalCuotas)}</p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-sm text-suave">Cuotas pagadas</p>
          <p className="text-2xl font-bold">
            {s.pagadas} de {s.total}
          </p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-sm text-suave">Saldo pendiente</p>
          <p className="text-2xl font-bold text-brand">{formatoSoles(s.saldo)}</p>
        </Tarjeta>
      </div>

      <h2 className="mb-2 mt-6 text-xl font-bold">Cuotas</h2>
      <Tarjeta className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-brand/5 text-sm text-suave">
              <tr>
                <th className="px-4 py-3 font-semibold">Cuota</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 text-right font-semibold">Monto</th>
                <th className="px-4 py-3 text-right font-semibold">Interés</th>
                <th className="px-4 py-3 text-right font-semibold">Total pago</th>
                <th className="px-4 py-3 text-right font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {s.cuotas.map((c) => {
                const interes = interesCuota(c)
                const total = totalPagoCuota(c)
                return (
                  <tr key={c.id} className="border-t border-borde">
                    <td className="px-4 py-3 font-semibold">
                      <Link to={`/recibos/${c.id}`} state={{ origen: `/prestamos/${p.id}` }} className="text-brand underline-offset-2 hover:underline">
                        {c.cuota} de {s.total}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatoFecha(c.fechaLimite)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatoSoles(c.monto)}</td>
                    <td className={`px-4 py-3 text-right ${interes > 0 ? 'font-semibold text-pend-tx' : ''}`}>{formatoSoles(interes)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatoSoles(total)}</td>
                    <td className="px-4 py-3 text-right">
                      <Insignia estado={estadoVisible(c, hoy)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  )
}
