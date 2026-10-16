// Service worker de Pagos Castillo: recibe los avisos (push) y los muestra como notificación.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let datos = {}
  try {
    datos = event.data ? event.data.json() : {}
  } catch {
    datos = { cuerpo: event.data ? event.data.text() : '' }
  }
  const titulo = datos.titulo || 'Pagos Castillo'
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || 'Tienes avisos de pagos.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'avisos-pagos', // reemplaza la anterior en vez de apilar
      data: { url: datos.url || '/avisos' },
    }),
  )
})

// Al tocar la notificación se abre (o se enfoca) la app en Avisos
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = (event.notification.data && event.notification.data.url) || '/avisos'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ('focus' in v) {
          v.navigate(destino)
          return v.focus()
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})
