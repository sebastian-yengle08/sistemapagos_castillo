// Marco de la aplicación: barra lateral (escritorio), barra superior y navegación inferior (celular).
import { useSyncExternalStore } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { Bell, CalendarDays, FilePlus2, Landmark, History, Lock, Building2, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useDatos } from '../data/useDatos'
import { agruparAvisos } from '../utils/avisos'
import { hoyISO } from '../utils/fechas'
import ActivarAvisos from './ActivarAvisos'

const MENU = {
  asistente: [
    { a: '/', t: 'Calendario', I: CalendarDays, fin: true },
    { a: '/avisos', t: 'Avisos', I: Bell },
    { a: '/recibos/nuevo', t: 'Nuevo recibo', I: FilePlus2 },
  ],
  gerente: [
    { a: '/', t: 'Calendario', I: CalendarDays, fin: true },
    { a: '/avisos', t: 'Avisos', I: Bell },
    { a: '/prestamos', t: 'Préstamos', I: Landmark },
    { a: '/historial', t: 'Historial', I: History },
  ],
}

/** true en pantallas de escritorio (>= 1024 px). Se usa para dibujar UNA sola navegación, no las dos. */
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

function Logo({ chico }) {
  return (
    <Link to="/" className="flex items-center gap-2 sm:gap-3" aria-label="Pagos Castillo, ir al calendario">
      <span className={`grid place-items-center rounded-xl border border-brand/40 bg-brand/20 text-brand ${chico ? 'h-9 w-9' : 'h-11 w-11'}`}>
        <Building2 size={chico ? 20 : 24} aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className={`block whitespace-nowrap font-bold text-tinta ${chico ? "text-lg" : "text-xl"}`}>Pagos Castillo</span>
        {!chico && <span className="block text-sm text-suave">Empresa Castillo</span>}
      </span>
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
  // En escritorio "Nuevo recibo" es el botón principal de la barra lateral (no se repite en el menú)
  const menuLateral = menu.filter((m) => m.t !== 'Nuevo recibo')
  const nombre = perfil === 'asistente' ? 'Asistente' : 'Gerente'

  return (
    <div className={`min-h-screen ${esEscritorio ? 'pl-72' : ''}`}>
      {/* Barra lateral fija: solo escritorio */}
      {esEscritorio && (
      <aside className="fixed inset-y-0 left-0 flex w-72 flex-col border-r border-borde bg-lienzo2 p-5">
        <Logo />
        {perfil === 'asistente' && (
          <Link to="/recibos/nuevo" className="mt-6 flex min-h-14 items-center justify-center gap-2 rounded-full bg-brand text-lg font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_8px_24px_-6px_rgba(10,132,255,.65)] transition hover:brightness-110 active:scale-[0.98]">
            <FilePlus2 size={22} aria-hidden="true" /> Nuevo recibo
          </Link>
        )}
        <nav className="mt-6 flex flex-col gap-1" aria-label="Menú principal">
          {menuLateral.map(({ a, t, I, fin }) => (
            <NavLink
              key={a}
              to={a}
              end={fin}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-xl px-4 text-base font-semibold transition-colors ${
                  isActive ? 'border border-brand/30 bg-brand/15 text-brand' : 'border border-transparent text-suave hover:bg-white/5'
                }`
              }
            >
              <I size={22} aria-hidden="true" /> {t}
              {t === 'Avisos' && avisos > 0 && <span className="ml-auto rounded-full bg-venc-tx px-2 py-0.5 text-xs font-bold text-white">{avisos}</span>}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto text-sm text-suave">Sesión de {nombre}</p>
      </aside>
      )}

      {/* Barra superior */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-borde bg-lienzo2/80 px-3 backdrop-blur sm:px-4 lg:px-8">
        {esEscritorio ? (
          <p className="text-base text-suave">
            Hola, <span className="font-bold text-tinta">{nombre}</span>
          </p>
        ) : (
          <Logo chico />
        )}
        <div className="flex items-center gap-2">
          <Link to="/avisos" aria-label={`Avisos: ${avisos}`} className="relative grid h-11 w-11 place-items-center rounded-full sm:h-12 sm:w-12 text-suave hover:bg-white/10">
            <Bell size={24} aria-hidden="true" />
            {avisos > 0 && (
              <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-venc-tx px-1 text-xs font-bold leading-5 text-white">{avisos}</span>
            )}
          </Link>
          <button type="button" onClick={bloquear} aria-label="Bloquear" className="flex min-h-12 items-center gap-2 rounded-full border border-borde bg-white/[.06] px-3 font-semibold hover:bg-white/[.12] sm:px-4">
            <Lock size={18} aria-hidden="true" /> <span className="hidden min-[400px]:inline">Bloquear</span>
          </button>
        </div>
      </header>

      <ActivarAvisos />

      <main key={pathname} className="mx-auto max-w-[1280px] px-4 pb-32 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
        <Outlet />
      </main>

      {/* Navegación inferior flotante (vidrio): solo celular. "Nuevo recibo" es el botón central destacado */}
      {!esEscritorio && (
      <nav aria-label="Menú principal" className="fixed inset-x-3 bottom-3 z-30 flex items-end justify-around rounded-[28px] border border-white/10 bg-sup/80 px-2 pb-1 shadow-[0_8px_32px_-4px_rgba(0,0,0,.6)] backdrop-blur-xl">
        {menu.map(({ a, t, I, fin }) =>
          t === 'Nuevo recibo' ? (
            <NavLink key={a} to={a} className="-mt-6 flex min-h-16 flex-1 flex-col items-center justify-end gap-0.5 text-xs font-semibold text-tinta">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-[0_8px_24px_-4px_rgba(10,132,255,.8)] ring-4 ring-fondo">
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
