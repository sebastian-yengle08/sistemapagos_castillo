// HU-12: historial de acciones (gerente). Solo lectura: sin filtros, buscador ni botones.
import { useMemo } from 'react'
import { LogIn, FilePlus2, Pencil, Trash2, Wallet, Landmark, History, Undo2 } from 'lucide-react'
import { useDatos } from '../data/useDatos'
import { Tarjeta, Vacio } from '../components/ui'
import { fechaLarga, fechaLimaDeInstante, horaLima, hoyISO, nombreDia, sumarDias } from '../utils/fechas'

const ICONOS = {
  ingreso: [LogIn, 'bg-slate-900/[.05] text-suave'],
  crear: [FilePlus2, 'bg-brand/10 text-brand'],
  editar: [Pencil, 'bg-pend-bg text-pend-tx'],
  eliminar: [Trash2, 'bg-venc-bg text-venc-tx'],
  pago: [Wallet, 'bg-pag-bg text-pag-tx'],
  prestamo: [Landmark, 'bg-brand/10 text-brand'],
  'corregir-pago': [Pencil, 'bg-pend-bg text-pend-tx'],
  'anular-pago': [Undo2, 'bg-venc-bg text-venc-tx'],
}

function tituloDia(fecha, hoy) {
  if (fecha === hoy) return 'Hoy'
  if (fecha === sumarDias(hoy, -1)) return 'Ayer'
  return `${nombreDia(fecha).replace(/^./, (c) => c.toUpperCase())}, ${fechaLarga(fecha)}`
}

export default function HistorialPage() {
  const { historial } = useDatos()
  const hoy = hoyISO()

  // Agrupa por día (hora de Lima), de lo más reciente a lo más antiguo
  const grupos = useMemo(() => {
    const orden = [...historial].sort((a, b) => (a.ts < b.ts ? 1 : -1))
    const mapa = new Map()
    for (const e of orden) {
      const f = fechaLimaDeInstante(e.ts)
      if (!mapa.has(f)) mapa.set(f, [])
      mapa.get(f).push(e)
    }
    return [...mapa.entries()]
  }, [historial])

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold sm:text-3xl">Historial</h1>
      <p className="mt-1 text-suave">Todo lo que se hizo en el sistema, de lo más reciente a lo más antiguo.</p>

      {grupos.length === 0 ? (
        <div className="mt-6">
          <Vacio icono={History} titulo="Aún no hay movimientos" texto="Cuando se use el sistema, las acciones aparecerán aquí." />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {grupos.map(([fecha, lista]) => (
            <section key={fecha} aria-label={tituloDia(fecha, hoy)}>
              <h2 className="mb-2 text-lg font-bold">{tituloDia(fecha, hoy)}</h2>
              <Tarjeta className="divide-y divide-borde">
                {lista.map((e) => {
                  const [Icono, clase] = ICONOS[e.accion] ?? ICONOS.ingreso
                  return (
                    <div key={e.id} className="flex items-center gap-3 p-3 sm:p-4">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${clase}`}>
                        <Icono size={20} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{e.texto}</p>
                        <p className="text-sm text-suave">{horaLima(e.ts)}</p>
                      </div>
                      <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${e.perfil === 'Gerente' ? 'bg-brand text-white' : 'bg-slate-900/[.05] text-tinta'}`}>{e.perfil}</span>
                    </div>
                  )
                })}
              </Tarjeta>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
