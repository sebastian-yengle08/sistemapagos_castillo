// HU-06: calendario mensual (pantalla principal de ambos perfiles).
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ChevronLeft, ChevronRight, CalendarOff, Clock, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useDatos } from '../data/useDatos'
import { Boton, Tarjeta, Vacio, Ventana } from '../components/ui'
import ReciboFila from '../components/ReciboFila'
import { estadoVisible } from '../utils/estado'
import { armar, diaSemanaLunes, diasDelMes, fechaLarga, hoyISO, nombreDia, nombreMes, partes, FECHA_MINIMA, fechaMaxima, fechaMaximaRecibo } from '../utils/fechas'
import { formatoSoles } from '../utils/dinero'

const SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const ETIQUETA = {
  Pendiente: 'bg-pend-bg text-pend-tx border-pend-bd',
  Pagado: 'bg-pag-bg text-pag-tx border-pag-bd',
  Vencido: 'bg-venc-bg text-venc-tx border-venc-bd',
}
const PUNTO = { Pendiente: 'bg-[#f59e0b]', Pagado: 'bg-[#16a34a]', Vencido: 'bg-[#dc2626]' }

// El calendario navega desde enero de 2026 hasta 24 años después de hoy.
const LIMITE_MIN = partes(FECHA_MINIMA)
const TOTAL_MIN = LIMITE_MIN.a * 12 + (LIMITE_MIN.m - 1)

function Contador({ titulo, valor, Icono, clase }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3 sm:p-4 ${clase}`}>
      <Icono size={26} className="hidden shrink-0 sm:block" aria-hidden="true" />
      <div>
        <p className="text-2xl font-bold leading-none sm:text-3xl">{valor}</p>
        <p className="mt-1 text-sm font-semibold sm:text-base">{titulo}</p>
      </div>
    </div>
  )
}

export default function CalendarioPage() {
  const { recibos } = useDatos()
  const { perfil } = useAuth()
  const { state } = useLocation()
  const hoy = hoyISO()
  const fechaMaxRecibo = fechaMaximaRecibo() // los recibos nuevos no pueden vencer después de hoy + 40 días
  const h = partes(hoy)
  const limiteMax = partes(fechaMaxima())
  const TOTAL_MAX = limiteMax.a * 12 + (limiteMax.m - 1)
  const [vista, setVista] = useState(() => {
    const total = h.a * 12 + (h.m - 1)
    const acotado = Math.min(Math.max(total, TOTAL_MIN), TOTAL_MAX)
    return { a: Math.floor(acotado / 12), m: (acotado % 12) + 1 }
  })
  const [dia, setDia] = useState(null) // día tocado (aaaa-mm-dd)
  const [filtro, setFiltro] = useState('Todos') // Todos | Pagado | Pendiente | Vencido

  const totalVista = vista.a * 12 + (vista.m - 1)
  const movimiento = (n) => {
    const total = Math.min(Math.max(totalVista + n, TOTAL_MIN), TOTAL_MAX)
    setVista({ a: Math.floor(total / 12), m: (total % 12) + 1 })
    setDia(null)
  }
  const irHoy = () => {
    const total = Math.min(Math.max(h.a * 12 + (h.m - 1), TOTAL_MIN), TOTAL_MAX)
    setVista({ a: Math.floor(total / 12), m: (total % 12) + 1 })
    setDia(null)
  }

  // Recibos agrupados por fecha límite
  const porFecha = useMemo(() => {
    const mapa = {}
    for (const r of recibos) (mapa[r.fechaLimite] ??= []).push(r)
    return mapa
  }, [recibos])

  // Solo CANTIDADES del mes que se está viendo (sin montos)
  const conteo = useMemo(() => {
    const c = { Pendiente: 0, Pagado: 0, Vencido: 0 }
    const prefijo = `${vista.a}-${String(vista.m).padStart(2, '0')}-`
    for (const r of recibos) if (r.fechaLimite.startsWith(prefijo)) c[estadoVisible(r, hoy)]++
    return c
  }, [recibos, vista, hoy])

  // Pagos del mes que se está viendo (incluye los ya pagados), según el filtro elegido
  const pagosMes = useMemo(() => {
    const prefijo = `${vista.a}-${String(vista.m).padStart(2, '0')}-`
    return recibos
      .filter((r) => r.fechaLimite.startsWith(prefijo) && (filtro === 'Todos' || estadoVisible(r, hoy) === filtro))
      .sort((a, b) => (a.fechaLimite < b.fechaLimite ? -1 : a.fechaLimite > b.fechaLimite ? 1 : 0))
  }, [recibos, vista, hoy, filtro])

  // Celdas del mes (con huecos al inicio según el día de la semana)
  const celdas = useMemo(() => {
    const vacias = diaSemanaLunes(vista.a, vista.m, 1)
    const total = diasDelMes(vista.a, vista.m)
    return [...Array(vacias).fill(null), ...Array.from({ length: total }, (_, i) => armar(vista.a, vista.m, i + 1))]
  }, [vista])

  const recibosDia = dia ? (porFecha[dia] ?? []) : []
  const totalDia = recibosDia.filter((r) => r.estado !== 'Pagado').reduce((t, r) => t + r.monto, 0) // solo lo que falta pagar

  // Resumen del día elegido y botón para agregar un recibo ese día (solo asistente)
  const resumenDia = dia && (
    <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-borde bg-slate-900/[.04] px-4 py-3">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" /> {recibosDia.length} {recibosDia.length === 1 ? 'recibo programado' : 'recibos programados'}
      </span>
      <span className="text-sm text-suave">
        Por pagar: <b className="text-base text-tinta">{formatoSoles(totalDia)}</b>
      </span>
    </div>
  )
  const agregarDia = dia && dia >= hoy && dia <= fechaMaxRecibo && perfil === 'asistente' && (
    <Link to={`/recibos/nuevo?fecha=${dia}`} className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand font-semibold text-white shadow-sm hover:brightness-110">
      <Plus size={20} aria-hidden="true" /> Agregar recibo a este día
    </Link>
  )
  const avisoFecha = dia && dia > fechaMaxRecibo && perfil === 'asistente' && (
    <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-900/[.03] px-4 py-3 text-center text-sm text-suave">
      Solo puedes registrar recibos con fecha hasta el {fechaLarga(fechaMaxRecibo)}.
    </p>
  )

  const panelDia = dia && (
    <Tarjeta className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold">{fechaLarga(dia)}</p>
          <p className="text-sm capitalize text-suave">{nombreDia(dia)}</p>
        </div>
        <button type="button" onClick={() => setDia(null)} aria-label="Cerrar" className="hidden rounded-full p-2 text-suave hover:bg-slate-900/10 xl:block">
          <X size={20} />
        </button>
      </div>
      {resumenDia}
      <div className="mt-3 flex flex-col gap-2">
        {recibosDia.length === 0 ? (
          <p className="rounded-xl bg-slate-900/[.04] p-4 text-center text-suave">No hay recibos este día.</p>
        ) : (
          recibosDia.map((r) => <ReciboDia key={r.id} r={r} hoy={hoy} />)
        )}
      </div>
      {agregarDia}
      {avisoFecha}
    </Tarjeta>
  )

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        {state?.aviso && (
          <p role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-pag-bd bg-pag-bg px-4 py-3 font-semibold text-pag-tx">
            <CheckCircle2 size={20} aria-hidden="true" /> {state.aviso}
          </p>
        )}
        {/* Navegación de mes */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center rounded-xl border border-borde bg-sup">
            <button type="button" onClick={() => movimiento(-1)} disabled={totalVista <= TOTAL_MIN} aria-label="Mes anterior" className="grid h-12 w-12 place-items-center rounded-l-xl hover:bg-slate-900/5 disabled:cursor-not-allowed disabled:opacity-40">
              <ChevronLeft size={22} />
            </button>
            <h1 className="min-w-36 text-center text-xl font-bold text-tinta sm:min-w-44 sm:text-2xl">
              {nombreMes(vista.m)} {vista.a}
            </h1>
            <button type="button" onClick={() => movimiento(1)} disabled={totalVista >= TOTAL_MAX} aria-label="Mes siguiente" className="grid h-12 w-12 place-items-center rounded-r-xl hover:bg-slate-900/5 disabled:cursor-not-allowed disabled:opacity-40">
              <ChevronRight size={22} />
            </button>
          </div>
          <Boton onClick={irHoy}>Hoy</Boton>
        </div>

        {/* Contadores: solo cantidades del mes visto */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4" aria-label="Resumen del mes">
          <Contador titulo="Pendientes" valor={conteo.Pendiente} Icono={Clock} clase="border-pend-bd bg-pend-bg/60 text-pend-tx" />
          <Contador titulo="Pagados" valor={conteo.Pagado} Icono={CheckCircle2} clase="border-pag-bd bg-pag-bg/60 text-pag-tx" />
          <Contador titulo="Vencidos" valor={conteo.Vencido} Icono={AlertCircle} clase="border-venc-bd bg-venc-bg/60 text-venc-tx" />
        </div>

        {/* Cuadrícula del mes */}
        <Tarjeta className="mt-4 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-borde bg-slate-900/[.03] text-center text-sm font-bold text-suave">
            {SEMANA.map((d) => (
              <div key={d} className="py-2.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {celdas.map((f, i) => {
              if (!f) return <div key={`v${i}`} className="min-h-14 bg-transparent sm:min-h-28 sm:border-b sm:border-r sm:border-borde sm:bg-slate-900/[.03]" />
              const lista = porFecha[f] ?? []
              const esHoy = f === hoy
              const elegido = f === dia
              const n = partes(f).d
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setDia(f)}
                  aria-label={`${fechaLarga(f)}: ${lista.length} recibos`}
                  className={`flex min-h-14 flex-col items-center gap-1 rounded-2xl p-1 text-left transition-colors hover:bg-slate-900/5 sm:min-h-28 sm:items-stretch sm:rounded-none sm:border-b sm:border-r sm:border-borde sm:p-1.5 ${elegido ? 'bg-brand/10 ring-2 ring-inset ring-brand' : ''}`}
                >
                  <span className={`grid h-7 w-7 place-items-center self-center rounded-full sm:self-start text-sm font-bold ${esHoy ? 'bg-brand text-white' : ''}`}>{n}</span>
                  {/* Celular: puntos de color; escritorio: etiquetas con la empresa */}
                  <span className="flex flex-wrap justify-center gap-1 sm:hidden">
                    {lista.slice(0, 4).map((r) => (
                      <span key={r.id} className={`h-2 w-2 rounded-full ${PUNTO[estadoVisible(r, hoy)]}`} />
                    ))}
                  </span>
                  <span className="hidden flex-col gap-1 sm:flex">
                    {lista.slice(0, 2).map((r) => (
                      <span key={r.id} className={`truncate rounded-md border px-1.5 text-xs font-semibold leading-5 ${ETIQUETA[estadoVisible(r, hoy)]}`}>
                        {r.empresa}
                      </span>
                    ))}
                    {lista.length > 2 && <span className="px-1 text-xs font-semibold text-suave">+{lista.length - 2} más</span>}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex justify-center gap-5 border-t border-borde p-3 text-sm text-suave sm:hidden" aria-label="Significado de los colores">
            {['Pendiente', 'Pagado', 'Vencido'].map((e) => (
              <span key={e} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${PUNTO[e]}`} aria-hidden="true" /> {e}
              </span>
            ))}
          </div>
        </Tarjeta>
        {Object.keys(conteo).every((k) => conteo[k] === 0) && (
          <div className="mt-4">
            <Vacio icono={CalendarOff} titulo="Aún no hay recibos este mes" texto="Cuando se registren recibos con fecha límite en este mes, aparecerán aquí." />
          </div>
        )}
      </div>

      {/* Columna derecha: día elegido (escritorio) + pagos del mes */}
      <aside className="flex flex-col gap-4">
        <div className="hidden xl:block">{panelDia}</div>
        <section aria-labelledby="pagos-mes">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="pagos-mes" className="text-xl font-bold">
              Pagos del mes
            </h2>
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              aria-label="Filtrar pagos del mes por estado"
              className="h-11 rounded-xl border border-borde bg-sup px-3 text-sm font-semibold text-tinta outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/25"
            >
              <option value="Todos">Todos</option>
              <option value="Pagado">Pagados</option>
              <option value="Pendiente">Pendientes</option>
              <option value="Vencido">Vencidos</option>
            </select>
          </div>
          {pagosMes.length === 0 ? (
            <Vacio
              icono={filtro === 'Pagado' ? CheckCircle2 : filtro === 'Pendiente' ? Clock : filtro === 'Vencido' ? AlertCircle : CalendarOff}
              titulo={
                filtro === 'Pagado' ? 'No hay pagos completados este mes' : filtro === 'Pendiente' ? 'No hay pagos pendientes este mes' : filtro === 'Vencido' ? 'No hay pagos vencidos este mes' : 'No hay pagos este mes'
              }
              texto={
                filtro === 'Pagado'
                  ? 'Los recibos pagados de este mes aparecerán aquí.'
                  : filtro === 'Pendiente'
                    ? 'No quedan recibos por pagar en este mes.'
                    : filtro === 'Vencido'
                      ? 'No hay recibos sin pagar con fecha límite vencida en este mes.'
                      : 'Cuando se registren recibos con fecha límite en este mes, aparecerán aquí.'
              }
            />
          ) : (
            <div className="flex flex-col gap-2 xl:max-h-[32rem] xl:overflow-y-auto xl:overscroll-contain xl:pr-2">
              {pagosMes.map((r) => (
                <ReciboFila key={r.id} recibo={r} hoy={hoy} />
              ))}
            </div>
          )}
        </section>
      </aside>

      {/* Celular: hoja inferior con los recibos del día */}
      <div className="xl:hidden">
        <Ventana abierta={!!dia} onCerrar={() => setDia(null)} titulo="Recibos del día">
          {dia && (
            <>
              <p className="text-xl font-bold">{fechaLarga(dia)}</p>
              <p className="text-sm capitalize text-suave">{nombreDia(dia)}</p>
              {resumenDia}
              <div className="mt-3 flex flex-col gap-2">
                {recibosDia.length === 0 ? <p className="rounded-xl bg-slate-900/[.04] p-4 text-center text-suave">No hay recibos este día.</p> : recibosDia.map((r) => <ReciboDia key={r.id} r={r} hoy={hoy} />)}
              </div>
              {agregarDia}
              {avisoFecha}
            </>
          )}
        </Ventana>
      </div>
    </div>
  )
}

/** Recibo dentro del panel del día, con botón "Ver detalle". */
function ReciboDia({ r, hoy }) {
  const estado = estadoVisible(r, hoy)
  return (
    <div className="rounded-xl border border-borde p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold">{r.empresa}</p>
          <p className="text-sm text-suave">{r.codigo}</p>
        </div>
        <p className="font-bold">{formatoSoles(r.monto)}</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-sm font-semibold ${ETIQUETA[estado]}`}>
          <span className={`h-2 w-2 rounded-full ${PUNTO[estado]}`} aria-hidden="true" />
          {estado}
        </span>
        <Link to={`/recibos/${r.id}`} state={{ origen: '/' }} className="inline-flex min-h-12 items-center rounded-full border border-borde bg-slate-900/[.05] px-4 font-semibold text-brand hover:bg-slate-900/10">
          Ver detalle
        </Link>
      </div>
    </div>
  )
}
