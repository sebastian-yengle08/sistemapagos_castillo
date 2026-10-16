// Marco de la aplicación.
// Escritorio: barra superior azul marino con el menú centrado, "Nuevo recibo" (asistente) y "Cerrar sesión".
// Celular: cabecera de color con el nombre de la empresa y barra de navegación inferior.
import { useSyncExternalStore } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { Bell, CalendarDays, FilePlus2, Landmark, History, LogOut, Building2, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useDatos } from '../data/useDatos'
import { agruparAvisos } from '../utils/avisos'
import { hoyISO } from '../utils/fechas'
import ActivarAvisos from './ActivarAvisos'

const MENU = {
  asistente: [
    { a: '/', t: 'Calendario', I: CalendarDays, fin: true },
    { a: '/avisos', t: 'Avisos', I: Bell },
    { a: '/prestamos', t: 'Préstamos', I: Landmark },
    { a: '/recibos/nuevo', t: 'Nuevo recibo', I: FilePlus2 },
  ],
  gerente: [
    { a: '/', t: 'Calendario', I: CalendarDays, fin: true },
    { a: '/avisos', t: 'Avisos', I: Bell },
    { a: '/prestamos', t: 'Préstamos', I: Landmark },
    { a: '/historial', t: 'Historial', I: History },
  ],
}

/** true en pantallas de escritorio (>= 1024 px). Se dibuja UNA sola navegación, no las dos. */
function useEsEscritorio() {
  const consulta = '(min-width: 1024px)'
  return useSyncExternalStore(
    (avisar) => {
      const m = window.matchMedia(consulta)
      m.addEventListener('change', avisar)
      return () => m.removeEventListener('change', avisar)
    },
    () => window.matchMedia(consulta).matches,
  )
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Pagos Castillo, ir al calendario">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-white">
        <Building2 size={20} aria-hidden="true" />
      </span>
      <span className="whitespace-nowrap text-xl font-extrabold tracking-tight text-white">Pagos Castillo</span>
    </Link>
  )
}

/** Campana con el contador de avisos. */
function Campana({ avisos }) {
  return (
    <Link to="/avisos" aria-label={`Avisos: ${avisos}`} className="relative grid h-11 w-11 place-items-center rounded-full text-white hover:bg-white/10">
      <Bell size={22} aria-hidden="true" />
      {avisos > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-venc-tx px-1 text-xs font-bold leading-5 text-white">{avisos}</span>}
    </Link>
  )
}

export default function Layout() {
  const { perfil, bloquear } = useAuth()
  const { recibos } = useDatos()
  const { pathname } = useLocation()
  const avisos = agruparAvisos(recibos, hoyISO()).total
  const menu = MENU[perfil]
  const esEscritorio = useEsEscritorio()
  const nombre = perfil === 'asistente' ? 'Asistente' : 'Gerente'

  return (
    <div className="min-h-screen">
      {esEscritorio ? (
        /* ── Escritorio: barra superior con el menú centrado ── */
        <header className="sticky top-0 z-30 bg-marino text-white shadow-sm">
          <div className="mx-auto grid h-16 max-w-[1280px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-8">
            <div className="justify-self-start">
              <Logo />
            </div>
            {/* Todos los botones del menú (incluido "Nuevo recibo" del asistente) quedan juntos y centrados */}
            <nav aria-label="Menú principal" className="flex items-center gap-1">
              {menu.map(({ a, t, fin }) =>
                t === 'Nuevo recibo' ? (
                  <NavLink key={a} to={a} className="ml-2 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 text-base font-bold text-marino transition hover:bg-slate-100 active:scale-[0.98]">
                    <Plus size={18} aria-hidden="true" /> {t}
                  </NavLink>
                ) : (
                  <NavLink
                    key={a}
                    to={a}
                    end={fin}
                    className={({ isActive }) => `rounded-lg px-4 py-2 text-base font-semibold transition-colors ${isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                  >
                    {t}
                  </NavLink>
                ),
              )}
            </nav>
            <div className="flex items-center justify-self-end gap-2">
              <Campana avisos={avisos} />
              <span className="px-2 text-base font-semibold text-white/90">{nombre}</span>
              <button type="button" onClick={bloquear} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold text-white/90 hover:bg-white/10 hover:text-white">
                <LogOut size={18} aria-hidden="true" /> Cerrar sesión
              </button>
            </div>
          </div>
        </header>
      ) : (
        /* ── Celular: cabecera de color con el nombre de la empresa ── */
        <header className="sticky top-0 z-30 bg-marino px-3 text-white shadow-sm">
          <div className="flex h-14 items-center justify-between">
            <Logo />
            <div className="flex items-center gap-1">
              <Campana avisos={avisos} />
              <button type="button" onClick={bloquear} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-white/90 hover:bg-white/10">
                <LogOut size={18} aria-hidden="true" /> Salir
              </button>
            </div>
          </div>
        </header>
      )}

      <ActivarAvisos />

      <main key={pathname} className="mx-auto max-w-[1280px] px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
        <Outlet />
      </main>

      {/* Celular: navegación inferior. "Nuevo recibo" es el botón central destacado (asistente) */}
      {!esEscritorio && (
        <nav aria-label="Menú principal" className="fixed inset-x-0 bottom-0 z-30 flex items-end justify-around rounded-t-3xl border-t border-borde bg-white px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(15,23,42,.08)]">
          {menu.map(({ a, t, I, fin }) =>
            t === 'Nuevo recibo' ? (
              <NavLink key={a} to={a} className="-mt-6 flex min-h-16 flex-1 flex-col items-center justify-end gap-0.5 text-xs font-semibold text-tinta">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-lg ring-4 ring-fondo">
                  <Plus size={28} aria-hidden="true" />
                </span>
                {t}
              </NavLink>
            ) : (
              <NavLink key={a} to={a} end={fin} className={({ isActive }) => `relative flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-brand' : 'text-suave'}`}>
                <I size={24} aria-hidden="true" />
                {t}
                {t === 'Avisos' && avisos > 0 && <span className="absolute right-[22%] top-2 min-w-5 rounded-full bg-venc-tx px-1 text-center text-xs font-bold leading-5 text-white">{avisos}</span>}
              </NavLink>
            ),
          )}
        </nav>
      )}
    </div>
  )
}
