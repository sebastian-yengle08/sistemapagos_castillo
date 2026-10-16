import { useSyncExternalStore } from 'react'
import { suscribir, obtenerEstado } from './store'

/** Hook para leer los datos y re-dibujar la pantalla cuando cambian. */
export function useDatos() {
  return useSyncExternalStore(suscribir, obtenerEstado)
}
