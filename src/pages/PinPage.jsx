// HU-00: entrada con PIN único. El PIN identifica a la persona (no se elige perfil).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, Delete, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { reiniciarDatos } from '../data/store'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export default function PinPage() {
  const { ingresar } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [revisando, setRevisando] = useState(false)
  const [reiniciado, setReiniciado] = useState(false)
  const ocupado = useRef(false)

  const verificar = useCallback(
    async (valor) => {
      ocupado.current = true
      setRevisando(true)
      const ok = await ingresar(valor)
      if (!ok) {
        setError(true)
        setPin('')
      }
      ocupado.current = false
      setRevisando(false)
    },
    [ingresar],
  )

  // El PIN vive también en una referencia para que varias teclas seguidas no se pierdan
  const valor = useRef('')
  const agregar = useCallback(
    (d) => {
      if (ocupado.current || valor.current.length >= 4) return
      setError(false)
      valor.current += d
      setPin(valor.current)
      if (valor.current.length === 4) {
        const completo = valor.current
        ocupado.current = true // bloquea teclas mientras se revisa
        setTimeout(() => {
          valor.current = ''
          verificar(completo)
        }, 150)
      }
    },
    [verificar],
  )
  const borrar = useCallback(() => {
    if (ocupado.current) return
    setError(false)
    valor.current = valor.current.slice(0, -1)
    setPin(valor.current)
  }, [])

  // El teclado físico también funciona
  useEffect(() => {
    const alTecla = (e) => {
      if (/^\d$/.test(e.key)) agregar(e.key)
      else if (e.key === 'Backspace') borrar()
    }
    window.addEventListener('keydown', alTecla)
    return () => window.removeEventListener('keydown', alTecla)
  }, [agregar, borrar])

  const tecla = 'grid h-[72px] w-[72px] place-items-center rounded-full border border-slate-300 bg-white text-3xl font-semibold text-tinta transition-colors hover:bg-slate-50 active:bg-brand/10 sm:h-20 sm:w-20'

  return (
    <div className="flex min-h-screen flex-col items-center bg-fondo px-4 py-8">
      <main className="flex w-full max-w-sm flex-1 flex-col items-center justify-center">
        <span className="grid h-20 w-20 place-items-center rounded-2xl bg-brand text-white shadow-lg">
          <Building2 size={40} aria-hidden="true" />
        </span>
        <p className="mt-3 text-2xl font-bold text-brand">Pagos Castillo</p>
        <h1 className="mt-6 text-3xl font-bold">Ingresa tu PIN</h1>
        <p className="mt-1 text-center text-suave">Código personal de 4 dígitos</p>

        <div className={`mt-6 flex gap-4 ${error ? 'sacudir' : ''}`} role="img" aria-label={`${pin.length} de 4 dígitos ingresados`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-5 w-5 rounded-full border-2 transition-colors ${error ? 'border-red-500 bg-red-500' : i < pin.length ? 'border-brand bg-brand' : 'border-slate-300 bg-white'}`} />
          ))}
        </div>

        <div className="mt-4 min-h-12" aria-live="polite">
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl border border-venc-bd bg-venc-bg px-4 py-2 font-semibold text-venc-tx">
              <AlertCircle size={20} aria-hidden="true" /> PIN incorrecto. Intenta de nuevo.
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-4 sm:gap-x-8">
          {TECLAS.map((t) => (
            <button key={t} type="button" onClick={() => agregar(t)} disabled={revisando} className={tecla} aria-label={t}>
              {t}
            </button>
          ))}
          <span />
          <button type="button" onClick={() => agregar('0')} disabled={revisando} className={tecla} aria-label="0">
            0
          </button>
          <button type="button" onClick={borrar} className={`${tecla} !border-transparent !bg-brand/10 text-brand`} aria-label="Borrar último dígito">
            <Delete size={30} aria-hidden="true" />
          </button>
        </div>
      </main>

      <footer className="mt-6 flex flex-col items-center gap-1 text-sm text-suave">
        <span>Empresa Castillo · Gestión de pagos</span>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs underline decoration-dotted hover:text-tinta"
          onClick={() => {
            reiniciarDatos()
            setReiniciado(true)
            setTimeout(() => setReiniciado(false), 2500)
          }}
        >
          {reiniciado ? 'Datos de ejemplo restablecidos ✓' : 'Restablecer datos de ejemplo'}
        </button>
      </footer>
    </div>
  )
}
