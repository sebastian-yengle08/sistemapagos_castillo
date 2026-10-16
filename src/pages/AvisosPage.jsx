// HU-13: avisos dentro del sistema (no son notificaciones push).
import { PartyPopper } from 'lucide-react'
import { useDatos } from '../data/useDatos'
import { Vacio } from '../components/ui'
import ReciboFila from '../components/ReciboFila'
import { agruparAvisos } from '../utils/avisos'
import { hoyISO } from '../utils/fechas'

const GRUPOS = [
  { k: 'hoy', t: 'Vence hoy', punto: 'bg-[#f59e0b]', acento: 'border-l-[#f59e0b]', titulo: 'text-tinta' },
  { k: 'tresDias', t: 'Vence en 3 días', punto: 'bg-brand', acento: 'border-l-brand', titulo: 'text-tinta' },
  { k: 'vencidos', t: 'Vencidos', punto: 'bg-[#dc2626]', acento: 'border-l-[#dc2626]', titulo: 'text-venc-tx' },
  { k: 'mes', t: 'Pendientes del mes', punto: 'bg-zinc-500', acento: 'border-l-zinc-500', titulo: 'text-tinta' },
]

export default function AvisosPage() {
  const { recibos } = useDatos()
  const hoy = hoyISO()
  const g = agruparAvisos(recibos, hoy)

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold sm:text-3xl">Avisos</h1>
      <p className="mt-1 text-suave">Recibos que necesitan tu atención.</p>

      {g.total === 0 ? (
        <div className="mt-6">
          <Vacio icono={PartyPopper} titulo="Estás al día" texto="No hay avisos" />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-7">
          {GRUPOS.filter(({ k }) => g[k].length > 0).map(({ k, t, punto, acento, titulo }) => (
            <section key={k} aria-labelledby={`g-${k}`}>
              <h2 id={`g-${k}`} className={`mb-2 flex items-center gap-2 text-lg font-bold ${titulo}`}>
                <span className={`h-3 w-3 rounded-full ${punto}`} aria-hidden="true" />
                {t}
                <span className="rounded-full bg-slate-900/[.05] px-2 text-sm font-semibold text-suave">{g[k].length}</span>
              </h2>
              <div className="flex flex-col gap-2">
                {g[k].map((r) => (
                  <ReciboFila key={r.id} recibo={r} hoy={hoy} acento={acento} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
