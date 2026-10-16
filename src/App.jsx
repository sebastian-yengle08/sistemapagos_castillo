// Rutas de la aplicación. Cada pantalla solo se muestra al perfil que corresponde.
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import PinPage from './pages/PinPage'
import CalendarioPage from './pages/CalendarioPage'
import AvisosPage from './pages/AvisosPage'
import ReciboFormPage from './pages/ReciboFormPage'
import ReciboDetallePage from './pages/ReciboDetallePage'
import PrestamosPage from './pages/PrestamosPage'
import PrestamoNuevoPage from './pages/PrestamoNuevoPage'
import PrestamoDetallePage from './pages/PrestamoDetallePage'
import HistorialPage from './pages/HistorialPage'

/** Deja pasar solo al perfil indicado; a los demás los manda al calendario. */
function Solo({ perfil: permitido, children }) {
  const { perfil } = useAuth()
  return perfil === permitido ? children : <Navigate to="/" replace />
}

export default function App() {
  const { perfil } = useAuth()
  if (!perfil) return <PinPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CalendarioPage />} />
        <Route path="avisos" element={<AvisosPage />} />
        <Route path="recibos/:id" element={<ReciboDetallePage />} />
        {/* Solo asistente */}
        <Route path="recibos/nuevo" element={<Solo perfil="asistente"><ReciboFormPage /></Solo>} />
        <Route path="recibos/:id/editar" element={<Solo perfil="asistente"><ReciboFormPage /></Solo>} />
        {/* Solo gerente */}
        <Route path="prestamos" element={<Solo perfil="gerente"><PrestamosPage /></Solo>} />
        <Route path="prestamos/nuevo" element={<Solo perfil="gerente"><PrestamoNuevoPage /></Solo>} />
        <Route path="prestamos/:id" element={<Solo perfil="gerente"><PrestamoDetallePage /></Solo>} />
        <Route path="historial" element={<Solo perfil="gerente"><HistorialPage /></Solo>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
