// Notificaciones del navegador (Web Push). Funcionan en celular y en computadora.
// - Se pide permiso con un botón (los navegadores lo exigen así).
// - El dispositivo queda suscrito y el servidor envía el aviso diario (api/enviar-avisos.js).
// - Además, al abrir la app se muestra una notificación local con el resumen del día.
import { guardarSuscripcion } from '../data/persistencia'
export { resumenAvisos } from './resumen'

const LLAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const soportaNotificaciones = () => 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window

export const permisoActual = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

/** iPhone/iPad: solo permite notificaciones si la app se agregó a la pantalla de inicio. */
export function necesitaInstalarEnIphone() {
  const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const instalada = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
  return esIos && !instalada
}

export async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch {
    return null
  }
}

function llaveABytes(base64) {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const crudo = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0))
}

/** Suscribe este dispositivo y guarda la suscripción en la base de datos. */
export async function suscribirDispositivo(perfil) {
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub && LLAVE_PUBLICA) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: llaveABytes(LLAVE_PUBLICA) })
  }
  if (sub) await guardarSuscripcion(sub.toJSON(), perfil)
  return !!sub
}

/** Pide permiso (debe llamarse desde un toque del usuario). Devuelve 'granted' | 'denied' | 'default'. */
export async function activarNotificaciones(perfil) {
  if (!soportaNotificaciones()) return 'unsupported'
  const permiso = await Notification.requestPermission()
  if (permiso === 'granted') {
    try {
      await suscribirDispositivo(perfil)
    } catch (e) {
      console.error('[Pagos Castillo] No se pudo suscribir el dispositivo', e)
    }
    await mostrarLocal('Avisos activados', 'Te avisaremos de los pagos que vencen.')
  }
  return permiso
}

export async function mostrarLocal(titulo, cuerpo) {
  if (permisoActual() !== 'granted') return
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification(titulo, { body: cuerpo, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'avisos-pagos', data: { url: '/avisos' } })
}
