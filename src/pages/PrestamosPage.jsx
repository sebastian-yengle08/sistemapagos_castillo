// HU-08: lista de préstamos (gerente).
import { Link } from 'react-router-dom'
import { Landmark, Plus } from 'lucide-react'
import { useDatos } from '../data/useDatos'
import { useAuth } from '../context/AuthContext'
import { resumenPrestamo } from '../data/store'
import { Tarjeta, Vacio } from '../components/ui'
import { formatoFecha } from '../utils/fechas'
import { formatoSoles } from '../utils/dinero'

export default function PrestamosPage() {
  const { prestamos, recibos } = useDatos()
  const { perfil } = useAuth()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Préstamos</h1>
          <p className="mt-1 text-suave">Cada cuota se convierte en un recibo que el asistente paga.</p>
        </div>
        {perfil === 'asistente' && (
          <Link to="/prestamos/nuevo" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-white hover:bg-brand-dark">
            <Plus size={20} aria-hidden="true" /> Nuevo préstamo
          </Link>
        )}
      </div>

      {prestamos.length === 0 ? (
        <div className="mt-6">
          <Vacio icono={Landmark} titulo="Aún no hay préstamos" texto={perfil === 'asistente' ? 'Registra un préstamo y sus cuotas aparecerán en el calendario.' : 'Cuando el asistente registre un préstamo, aparecerá aquí.'} />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {prestamos.map((p) => {
            const s = resumenPrestamo(p, recibos)
            const pct = s.total ? Math.round((s.pagadas / s.total) * 100) : 0
            return (
              <Link key={p.id} to={`/prestamos/${p.id}`} className="block">
                <Tarjeta className="p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand">
                      <Landmark size={24} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-bold">{p.entidad}</h2>
                      <p className="text-sm text-suave">
                        {s.pagadas} de {s.total} cuotas pagadas
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-900/[.05]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de cuotas pagadas">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-sm text-suave">Saldo pendiente</dt>
                      <dd className="text-xl font-bold">{formatoSoles(s.saldo)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-suave">Próximo vencimiento</dt>
                      <dd className="text-xl font-bold">{s.proximo ? formatoFecha(s.proximo) : '—'}</dd>
                    </div>
                  </dl>
                </Tarjeta>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
