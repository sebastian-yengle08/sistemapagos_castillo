// Si se publicó una versión nueva de la app, recarga la página para usarla.
// Sin esto, un celular que dejó la app abierta seguiría con el código viejo.
export async function buscarVersionNueva() {
  if (typeof __BUILD_ID__ === 'undefined' || __BUILD_ID__ === 'dev') return
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return
    const { id } = await r.json()
    if (id && id !== __BUILD_ID__) window.location.reload()
  } catch {
    /* sin conexión o respuesta no válida: no se hace nada */
  }
}
