import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { PIN_HASHES } from '../config/pins'
import { hashPin } from '../utils/hash'
import { definirActor, registrarIngreso } from '../data/store'

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
    registrarIngreso(encontrado)
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

  const valor = useMemo(() => ({ perfil, ingresar, bloquear }), [perfil, ingresar, bloquear])
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
