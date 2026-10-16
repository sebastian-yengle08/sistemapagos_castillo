// Rutas de la aplicación. Cada pantalla solo se muestra al perfil que corresponde.
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import AvisoError from './components/AvisoError'
import PinPage from './pages/PinPage'
import CalendarioPage from './pages/CalendarioPage'
import AvisosPage from './pages/AvisosPage'
import ReciboFormPage from './pages/ReciboFormPage'
import ReciboDetallePage from './pages/ReciboDetallePage'
import PrestamosPage from './pages/PrestamosPage'
import PrestamoFormPage from './pages/PrestamoFormPage'
import PrestamoDetallePage from './pages/PrestamoDetallePage'
import HistorialPage from './pages/HistorialPage'

/** Deja pasar solo al perfil indicado; a los demás los manda al calendario. */
function Solo({ perfil: permitido, children }) {
  const { perfil } = useAuth()
  return perfil === permitido ? children : <Navigate to="/" replace />
}

export default function App() {
  const { perfil } = useAuth()
  if (!perfil) return <><PinPage /><AvisoError /></>

  return (
    <>
    <AvisoError />
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CalendarioPage />} />
        <Route path="avisos" element={<AvisosPage />} />
        <Route path="recibos/:id" element={<ReciboDetallePage />} />
        {/* Solo asistente (recibos y préstamos) */}
        <Route path="recibos/nuevo" element={<Solo perfil="asistente"><ReciboFormPage /></Solo>} />
        <Route path="recibos/:id/editar" element={<Solo perfil="asistente"><ReciboFormPage /></Solo>} />
        {/* Solo gerente; los préstamos los ven ambos, pero solo el asistente los crea y edita */}
        <Route path="prestamos" element={<PrestamosPage />} />
        <Route path="prestamos/nuevo" element={<Solo perfil="asistente"><PrestamoFormPage /></Solo>} />
        <Route path="prestamos/:id/editar" element={<Solo perfil="asistente"><PrestamoFormPage /></Solo>} />
        <Route path="prestamos/:id" element={<PrestamoDetallePage />} />
        <Route path="historial" element={<Solo perfil="gerente"><HistorialPage /></Solo>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </>
  )
}
