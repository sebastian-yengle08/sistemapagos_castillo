import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { iniciarDatos, refrescar } from './data/store'
import { registrarServiceWorker } from './utils/notificaciones'

const raiz = createRoot(document.getElementById('root'))
raiz.render(
  <p className="grid min-h-screen place-items-center text-lg font-semibold text-suave" role="status">
    Cargando Pagos Castillo…
  </p>,
)

// Primero se cargan los datos (Supabase o localStorage) y luego se muestra la app
iniciarDatos().then(() => {
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

// Al volver a la pestaña se actualizan los datos por si alguien más hizo cambios
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refrescar()
})

// Service worker: necesario para recibir notificaciones
registrarServiceWorker()
