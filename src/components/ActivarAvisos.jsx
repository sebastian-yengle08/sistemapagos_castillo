// Franja para activar las notificaciones en este dispositivo (celular o computadora),
// y notificación local con el resumen del día cuando se abre la app.
import { useEffect, useState } from 'react'
import { BellRing, Share, X } from 'lucide-react'
import { Boton } from './ui'
import { useAuth } from '../context/AuthContext'
import { useDatos } from '../data/useDatos'
import { agruparAvisos } from '../utils/avisos'
import { hoyISO } from '../utils/fechas'
import { activarNotificaciones, mostrarLocal, necesitaInstalarEnIphone, permisoActual, resumenAvisos, soportaNotificaciones, suscribirDispositivo } from '../utils/notificaciones'

const LLAVE_OCULTAR = 'pagosCastillo.ocultarAvisos'
const LLAVE_DIA = 'pagosCastillo.avisoLocalDia'

const leer = (k) => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const guardar = (k, v) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* ignorar */
  }
}

export default function ActivarAvisos() {
  const { perfil } = useAuth()
  const { recibos } = useDatos()
  const [permiso, setPermiso] = useState(permisoActual())
  const [oculto, setOculto] = useState(leer(LLAVE_OCULTAR) === '1')
  const [trabajando, setTrabajando] = useState(false)

  // Si ya hay permiso: se asegura la suscripción y se muestra el resumen del día (una vez al día)
  useEffect(() => {
    if (permiso !== 'granted' || !soportaNotificaciones()) return
    suscribirDispositivo(perfil).catch(() => {})
    const hoy = hoyISO()
    if (leer(LLAVE_DIA) === hoy) return
    const cuerpo = resumenAvisos(agruparAvisos(recibos, hoy))
    if (cuerpo) {
      guardar(LLAVE_DIA, hoy)
      mostrarLocal('Pagos Castillo', cuerpo).catch(() => {})
    }
  }, [permiso, perfil, recibos])

  async function activar() {
    setTrabajando(true)
    setPermiso(await activarNotificaciones(perfil))
    setTrabajando(false)
  }

  // iPhone fuera de la pantalla de inicio: no permite notificaciones hasta instalarla
  if (necesitaInstalarEnIphone() && !oculto) {
    return (
      <Franja onCerrar={() => { guardar(LLAVE_OCULTAR, '1'); setOculto(true) }}>
        <Share size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="flex-1 text-sm font-semibold">Para recibir avisos en tu iPhone: toca Compartir y luego “Agregar a pantalla de inicio”. Abre Pagos Castillo desde ese ícono.</p>
      </Franja>
    )
  }

  if (!soportaNotificaciones() || permiso !== 'default' || oculto) return null
  return (
    <Franja onCerrar={() => { guardar(LLAVE_OCULTAR, '1'); setOculto(true) }}>
      <BellRing size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm font-semibold sm:text-base">Activa las notificaciones para saber qué vence hoy, aunque no tengas la app abierta.</p>
      <Boton variante="primario" onClick={activar} disabled={trabajando} className="!min-h-11 shrink-0">
        {trabajando ? 'Activando…' : 'Activar avisos'}
      </Boton>
    </Franja>
  )
}

function Franja({ children, onCerrar }) {
  return (
    <div className="border-b border-brand/20 bg-brand/5">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-3 py-3 text-brand sm:px-4 lg:px-8">
        {children}
        <button type="button" onClick={onCerrar} aria-label="Ahora no" className="rounded-full p-2 hover:bg-brand/10">
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
