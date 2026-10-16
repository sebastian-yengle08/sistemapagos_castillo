// Marco de la aplicación: barra lateral (escritorio), barra superior y navegación inferior (celular).
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { Bell, CalendarDays, FilePlus2, Landmark, History, Lock, Building2 } from 'lucide-react'
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

function Logo({ chico }) {
  return (
    <Link to="/" className="flex items-center gap-2 sm:gap-3" aria-label="Pagos Castillo, ir al calendario">
      <span className={`grid place-items-center rounded-xl bg-brand text-white ${chico ? 'h-9 w-9' : 'h-11 w-11'}`}>
        <Building2 size={chico ? 20 : 24} aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className={`block whitespace-nowrap font-bold text-brand ${chico ? "text-lg" : "text-xl"}`}>Pagos Castillo</span>
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
  const nombre = perfil === 'asistente' ? 'Asistente' : 'Gerente'

  return (
    <div className="min-h-screen lg:pl-72">
      {/* Barra lateral fija: solo escritorio */}
      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-borde bg-white p-5 lg:flex">
        <Logo />
        {perfil === 'asistente' && (
          <Link to="/recibos/nuevo" className="mt-6 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand text-lg font-bold text-white hover:bg-brand-dark">
            <FilePlus2 size={22} aria-hidden="true" /> Nuevo recibo
          </Link>
        )}
        <nav className="mt-6 flex flex-col gap-1" aria-label="Menú principal">
          {menu.map(({ a, t, I, fin }) => (
            <NavLink
              key={a}
              to={a}
              end={fin}
              className={({ isActive }) =>
                `flex min-h-12 items-center gap-3 rounded-xl px-4 text-base font-semibold transition-colors ${
                  isActive ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50'
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

      {/* Barra superior */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-borde bg-white/95 px-3 backdrop-blur sm:px-4 lg:px-8">
        <div className="lg:hidden">
          <Logo chico />
        </div>
        <p className="hidden text-base text-suave lg:block">
          Hola, <span className="font-bold text-tinta">{nombre}</span>
        </p>
        <div className="flex items-center gap-2">
          <Link to="/avisos" aria-label={`Avisos: ${avisos}`} className="relative grid h-11 w-11 place-items-center rounded-full sm:h-12 sm:w-12 text-slate-600 hover:bg-slate-100">
            <Bell size={24} aria-hidden="true" />
            {avisos > 0 && (
              <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-venc-tx px-1 text-xs font-bold leading-5 text-white">{avisos}</span>
            )}
          </Link>
          <button type="button" onClick={bloquear} aria-label="Bloquear" className="flex min-h-12 items-center gap-2 rounded-xl border-[1.5px] border-borde px-3 font-semibold hover:bg-slate-50 sm:px-4">
            <Lock size={18} aria-hidden="true" /> <span className="hidden min-[400px]:inline">Bloquear</span>
          </button>
        </div>
      </header>

      <ActivarAvisos />

      <main key={pathname} className="mx-auto max-w-[1280px] px-4 pb-28 pt-5 lg:px-8 lg:pb-10 lg:pt-8">
        <Outlet />
      </main>

      {/* Navegación inferior: solo celular */}
      <nav aria-label="Menú principal" className="fixed inset-x-0 bottom-0 z-30 grid border-t border-borde bg-white lg:hidden" style={{ gridTemplateColumns: `repeat(${menu.length}, 1fr)` }}>
        {menu.map(({ a, t, I, fin }) => (
          <NavLink key={a} to={a} end={fin} className={({ isActive }) => `relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-brand' : 'text-suave'}`}>
            <I size={24} aria-hidden="true" />
            {t}
            {t === 'Avisos' && avisos > 0 && <span className="absolute right-1/4 top-1.5 min-w-5 rounded-full bg-venc-tx px-1 text-center text-xs font-bold leading-5 text-white">{avisos}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
