// Bloqueo de pagos. El gerente lo activa o lo quita; mientras está activo, el asistente no puede
// registrar ni corregir pagos. Se muestra como franja arriba de todas las pantallas.
import { useState } from 'react'
import { Lock, LockOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useDatos } from '../data/useDatos'
import { bloquearPagos, motivoRechazo } from '../data/store'
import { Boton, Ventana } from './ui'

export default function BloqueoPagos() {
  const { perfil } = useAuth()
  const { bloqueo } = useDatos()
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState('')
  const activo = !!bloqueo?.activo

  function cambiar() {
    if (!bloquearPagos(!activo)) {
      setError(motivoRechazo().mensaje)
      return
    }
    setError('')
    setConfirmando(false)
  }

  if (perfil === 'gerente') {
    return (
      <>
        <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${activo ? 'border-venc-bd bg-venc-bg text-venc-tx' : 'border-borde bg-sup text-suave'}`}>
          <p className="flex items-center gap-2 font-semibold">
            {activo ? <Lock size={20} aria-hidden="true" /> : <LockOpen size={20} aria-hidden="true" />}
            {activo ? 'Pagos bloqueados: el asistente no puede pagar.' : 'Pagos habilitados.'}
          </p>
          <Boton onClick={() => setConfirmando(true)} className="!min-h-11">
            {activo ? 'Quitar bloqueo' : 'Bloquear pagos'}
          </Boton>
        </div>
        <Ventana abierta={confirmando} onCerrar={() => setConfirmando(false)} titulo={activo ? 'Quitar bloqueo de pagos' : 'Bloquear pagos'}>
          <h2 className="text-2xl font-bold">{activo ? '¿Quitar el bloqueo?' : '¿Bloquear los pagos?'}</h2>
          <p className="mt-2 text-suave">
            {activo ? 'El asistente podrá volver a registrar y corregir pagos.' : 'El asistente no podrá registrar ni corregir pagos hasta que quites el bloqueo.'}
          </p>
          {error && (
            <p role="alert" className="mt-3 rounded-xl border border-venc-bd bg-venc-bg px-4 py-3 text-sm font-semibold text-venc-tx">
              {error}
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Boton onClick={() => setConfirmando(false)}>Cancelar</Boton>
            <Boton variante="primario" onClick={cambiar}>
              {activo ? 'Quitar bloqueo' : 'Bloquear'}
            </Boton>
          </div>
        </Ventana>
      </>
    )
  }

  if (!activo) return null
  return (
    <p role="status" className="mb-4 flex items-center gap-2 rounded-2xl border border-venc-bd bg-venc-bg px-4 py-3 font-semibold text-venc-tx">
      <Lock size={20} aria-hidden="true" className="shrink-0" /> El gerente bloqueó los pagos. No puedes registrar ni corregir pagos hasta que lo quite.
    </p>
  )
}
