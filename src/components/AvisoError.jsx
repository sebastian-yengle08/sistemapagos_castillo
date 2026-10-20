import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

/** Franja que avisa de un problema al guardar o cargar los datos (conexión o cambio simultáneo en otro dispositivo). */
export default function AvisoError() {
  const [mensaje, setMensaje] = useState(null)
  useEffect(() => {
    const alError = (e) => setMensaje(e.detail)
    window.addEventListener('pagos:error', alError)
    return () => window.removeEventListener('pagos:error', alError)
  }, [])
  if (!mensaje) return null
  return (
    <div role="alert" className="fixed inset-x-3 bottom-20 z-[60] mx-auto flex max-w-xl items-start gap-3 rounded-2xl border border-venc-bd bg-venc-bg p-4 text-venc-tx shadow-lg lg:bottom-6">
      <AlertTriangle size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p className="flex-1 text-sm font-semibold">{mensaje}</p>
      <button type="button" onClick={() => setMensaje(null)} aria-label="Cerrar aviso" className="rounded-full p-1 hover:bg-slate-900/10">
        <X size={18} />
      </button>
    </div>
  )
}
