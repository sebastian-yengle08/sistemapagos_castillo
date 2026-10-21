// HU-13: avisos dentro del sistema (no son notificaciones push).
// "Todos" muestra los avisos de siempre (vence hoy, en 3 días, vencidos, pendientes del mes).
// Los demás filtros revisan TODOS los recibos del sistema y los separan por mes.
import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Clock, PartyPopper } from 'lucide-react'
import { useDatos } from '../data/useDatos'
import { Vacio } from '../components/ui'
import ReciboFila from '../components/ReciboFila'
import { agruparAvisos } from '../utils/avisos'
import { estadoVisible } from '../utils/estado'
import { hoyISO, nombreMes, partes } from '../utils/fechas'

const GRUPOS = [
  { k: 'hoy', t: 'Vence hoy', punto: 'bg-[#f59e0b]', acento: 'border-l-[#f59e0b]', titulo: 'text-tinta' },
  { k: 'tresDias', t: 'Vence en 3 días', punto: 'bg-brand', acento: 'border-l-brand', titulo: 'text-tinta' },
  { k: 'vencidos', t: 'Vencidos', punto: 'bg-[#dc2626]', acento: 'border-l-[#dc2626]', titulo: 'text-venc-tx' },
  { k: 'mes', t: 'Pendientes del mes', punto: 'bg-zinc-500', acento: 'border-l-zinc-500', titulo: 'text-tinta' },
]

// Filtro → estado que se busca, textos de "no hay" y orden de los meses (los pagados, del más reciente al más antiguo)
const FILTROS = {
  Pagado: { estado: 'Pagado', icono: CheckCircle2, vacio: 'No hay pagos completados', texto: 'Los recibos pagados aparecerán aquí, separados por mes.', recientePrimero: true },
  Pendiente: { estado: 'Pendiente', icono: Clock, vacio: 'No hay pagos pendientes', texto: 'No queda ningún recibo por pagar.', recientePrimero: false },
  Vencido: { estado: 'Vencido', icono: AlertCircle, vacio: 'No hay pagos vencidos', texto: 'No hay recibos sin pagar con la fecha límite vencida.', recientePrimero: false },
}

/** Agrupa los recibos por mes de su fecha límite: [{ clave: 'aaaa-mm', titulo: 'Octubre 2026', recibos: [...] }]. */
function agruparPorMes(lista, recientePrimero) {
  const meses = new Map()
  for (const r of lista) {
    const { a, m } = partes(r.fechaLimite)
    const clave = `${a}-${String(m).padStart(2, '0')}`
    if (!meses.has(clave)) meses.set(clave, { clave, titulo: `${nombreMes(m)} ${a}`, recibos: [] })
    meses.get(clave).recibos.push(r)
  }
  const orden = (x, y) => (x < y ? -1 : x > y ? 1 : 0)
  const grupos = [...meses.values()].sort((x, y) => orden(x.clave, y.clave) * (recientePrimero ? -1 : 1))
  grupos.forEach((g) => g.recibos.sort((x, y) => orden(x.fechaLimite, y.fechaLimite) * (recientePrimero ? -1 : 1)))
  return grupos
}

export default function AvisosPage() {
  const { recibos } = useDatos()
  const hoy = hoyISO()
  const [filtro, setFiltro] = useState('Todos') // Todos | Pagado | Pendiente | Vencido
  const g = agruparAvisos(recibos, hoy)
  const f = FILTROS[filtro]

  const meses = useMemo(() => (f ? agruparPorMes(recibos.filter((r) => estadoVisible(r, hoy) === f.estado), f.recientePrimero) : []), [recibos, hoy, f])
  const cantidad = meses.reduce((n, m) => n + m.recibos.length, 0)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Avisos</h1>
          <p className="mt-1 text-suave">{f ? 'Todos los recibos del sistema, separados por mes.' : 'Recibos que necesitan tu atención.'}</p>
        </div>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          aria-label="Filtrar avisos por estado"
          className="h-11 rounded-xl border border-borde bg-sup px-3 text-sm font-semibold text-tinta outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/25"
        >
          <option value="Todos">Todos</option>
          <option value="Pagado">Pagados</option>
          <option value="Pendiente">Pendientes</option>
          <option value="Vencido">Vencidos</option>
        </select>
      </div>

      {f ? (
        cantidad === 0 ? (
          <div className="mt-6">
            <Vacio icono={f.icono} titulo={f.vacio} texto={f.texto} />
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-7">
            {meses.map((m) => (
              <section key={m.clave} aria-labelledby={`m-${m.clave}`}>
                <h2 id={`m-${m.clave}`} className="mb-2 flex items-center gap-2 text-lg font-bold">
                  {m.titulo}
                  <span className="rounded-full bg-slate-900/[.05] px-2 text-sm font-semibold text-suave">{m.recibos.length}</span>
                </h2>
                <div className="flex flex-col gap-2">
                  {m.recibos.map((r) => (
                    <ReciboFila key={r.id} recibo={r} hoy={hoy} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : g.total === 0 ? (
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
