import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { iniciarDatos, iniciarSincronizacion, refrescar } from './data/store'
import { registrarServiceWorker } from './utils/notificaciones'
import { buscarVersionNueva } from './utils/actualizacion'

const raiz = createRoot(document.getElementById('root'))
raiz.render(
  <p className="grid min-h-screen place-items-center text-lg font-semibold text-suave" role="status">
    Cargando Pagos Castillo…
  </p>,
)

// Primero se cargan los datos (Supabase o localStorage) y luego se muestra la app
iniciarDatos().then(() => {
  iniciarSincronizacion() // los cambios de otros dispositivos aparecen solos
  raiz.render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
})

// Al volver a la app (celulares: se pausa en segundo plano) se actualizan los datos
// y se comprueba si hay una versión nueva publicada.
function alVolver() {
  if (document.visibilityState === 'hidden') return
  refrescar()
  buscarVersionNueva()
}
document.addEventListener('visibilitychange', alVolver)
window.addEventListener('focus', alVolver)
window.addEventListener('pageshow', alVolver)
window.addEventListener('online', alVolver)
buscarVersionNueva()

// Service worker: necesario para recibir notificaciones
registrarServiceWorker()
