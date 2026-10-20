import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { PIN_HASHES } from '../config/pins'
import { hashPin } from '../utils/hash'
import { definirActor } from '../data/store'
import { INACTIVIDAD_MIN } from '../config/constantes'

const CLAVE_SESION = 'pagosCastillo.sesion'
const AuthContext = createContext(null)

function leerSesion() {
  try {
    const p = sessionStorage.getItem(CLAVE_SESION)
    if (p === 'asistente' || p === 'gerente') {
      definirActor(p)
      return p
    }
  } catch {
    /* sin sessionStorage: se pide el PIN de nuevo */
  }
  return null
}

/** Maneja quién ingresó (asistente o gerente). La sesión vive en sessionStorage. */
export function AuthProvider({ children }) {
  const [perfil, setPerfil] = useState(leerSesion)

  /** Devuelve true si el PIN es correcto. El PIN identifica el perfil. */
  const ingresar = useCallback(async (pin) => {
    const h = await hashPin(pin)
    const encontrado = Object.keys(PIN_HASHES).find((k) => PIN_HASHES[k] === h)
    if (!encontrado) return false
    try {
      sessionStorage.setItem(CLAVE_SESION, encontrado)
    } catch {
      /* ignorar */
    }
    definirActor(encontrado)
    setPerfil(encontrado)
    return true
  }, [])

  const bloquear = useCallback(() => {
    try {
      sessionStorage.removeItem(CLAVE_SESION)
    } catch {
      /* ignorar */
    }
    definirActor(null)
    setPerfil(null)
  }, [])

  // Si nadie toca la pantalla en INACTIVIDAD_MIN minutos, la sesión se cierra (por si queda abierta en un equipo compartido)
  useEffect(() => {
    if (!perfil) return undefined
    let ultimo = Date.now()
    const marcar = () => {
      ultimo = Date.now()
    }
    const vencida = () => Date.now() - ultimo > INACTIVIDAD_MIN * 60 * 1000
    const alVolver = () => {
      if (document.visibilityState === 'visible' && vencida()) bloquear()
    }
    const eventos = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    eventos.forEach((e) => window.addEventListener(e, marcar, { passive: true }))
    document.addEventListener('visibilitychange', alVolver)
    const reloj = setInterval(() => vencida() && bloquear(), 15000)
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, marcar))
      document.removeEventListener('visibilitychange', alVolver)
      clearInterval(reloj)
    }
  }, [perfil, bloquear])

  const valor = useMemo(() => ({ perfil, ingresar, bloquear }), [perfil, ingresar, bloquear])
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
