import { PIN_PREFIJO } from '../config/pins'

// SHA-256 en hexadecimal usando Web Crypto.
export async function sha256(texto) {
  const datos = new TextEncoder().encode(texto)
  const buf = await crypto.subtle.digest('SHA-256', datos)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const hashPin = (pin) => sha256(PIN_PREFIJO + pin)
