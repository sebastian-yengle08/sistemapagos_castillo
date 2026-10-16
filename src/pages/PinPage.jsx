// HU-00: entrada con PIN único. El PIN identifica a la persona (no se elige perfil).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Building2, Delete, AlertCircle, CalendarCheck, BellRing, Wallet } from 'lucide-react'
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

  const tecla = 'grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/[.06] text-3xl font-semibold text-tinta transition-colors hover:bg-white/[.12] active:bg-brand/25 sm:h-20 sm:w-20 lg:h-[84px] lg:w-[84px]'

  return (
    <div className="min-h-dvh bg-fondo lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Panel de marca: solo escritorio */}
      <aside className="hidden flex-col justify-between border-r border-borde bg-lienzo2 bg-[radial-gradient(60%_50%_at_20%_15%,rgba(10,132,255,.35),transparent),radial-gradient(50%_40%_at_90%_95%,rgba(10,132,255,.18),transparent)] p-12 text-white lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-brand/40 bg-brand/20 text-brand">
            <Building2 size={26} aria-hidden="true" />
          </span>
          <span className="text-2xl font-bold">Pagos Castillo</span>
        </div>
        <div>
          <h2 className="max-w-md text-4xl font-bold leading-tight xl:text-5xl">Todos los pagos de la empresa, en orden y a la vista.</h2>
          <ul className="mt-8 flex max-w-md flex-col gap-4 text-lg text-white/90">
            <li className="flex items-center gap-3"><CalendarCheck size={24} aria-hidden="true" /> Calendario con cada fecha de vencimiento</li>
            <li className="flex items-center gap-3"><BellRing size={24} aria-hidden="true" /> Avisos de lo que vence hoy y lo vencido</li>
            <li className="flex items-center gap-3"><Wallet size={24} aria-hidden="true" /> Registro de pagos en pocos toques</li>
          </ul>
        </div>
        <p className="text-sm text-white/70">Empresa Castillo · Gestión de pagos</p>
      </aside>

      <div className="flex min-h-dvh flex-col items-center px-4 py-5 lg:justify-center lg:py-8">
        <main className="flex w-full max-w-sm flex-1 flex-col items-center justify-center lg:max-w-md lg:flex-none lg:rounded-3xl lg:border lg:border-borde lg:bg-sup lg:px-10 lg:py-10 lg:shadow-[0_20px_25px_-5px_rgba(15,23,42,.08)]">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid h-12 w-12 place-items-center rounded-xl border border-brand/40 bg-brand/20 text-brand">
              <Building2 size={26} aria-hidden="true" />
            </span>
            <p className="text-2xl font-bold">Pagos Castillo</p>
          </div>
          <h1 className="mt-5 text-3xl font-bold lg:mt-0">Ingresa tu PIN</h1>
          <p className="mt-1 text-center text-suave">Código personal de 4 dígitos</p>

          <div className={`mt-6 flex gap-4 ${error ? 'sacudir' : ''}`} role="img" aria-label={`${pin.length} de 4 dígitos ingresados`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-5 w-5 rounded-full border-2 transition-colors ${error ? 'border-[#ff453a] bg-[#ff453a]' : i < pin.length ? 'border-brand bg-brand' : 'border-white/20 bg-transparent'}`} />
            ))}
          </div>

          <div className="mt-3 min-h-11" aria-live="polite">
            {error && (
              <p role="alert" className="flex items-center gap-2 rounded-xl border border-venc-bd bg-venc-bg px-4 py-2 font-semibold text-venc-tx">
                <AlertCircle size={20} aria-hidden="true" /> PIN incorrecto. Intenta de nuevo.
              </p>
            )}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-x-6 gap-y-3 sm:gap-x-8 sm:gap-y-4">
            {TECLAS.map((t) => (
              <button key={t} type="button" onClick={() => agregar(t)} disabled={revisando} className={tecla} aria-label={t}>
                {t}
              </button>
            ))}
            <span />
            <button type="button" onClick={() => agregar('0')} disabled={revisando} className={tecla} aria-label="0">
              0
            </button>
            <button type="button" onClick={borrar} className={`${tecla} !border-transparent !bg-transparent text-suave`} aria-label="Borrar último dígito">
              <Delete size={30} aria-hidden="true" />
            </button>
          </div>
        </main>

        <footer className="mt-4 flex flex-col items-center gap-1 text-sm text-suave">
          <span className="lg:hidden">Empresa Castillo · Gestión de pagos</span>
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
    </div>
  )
}
