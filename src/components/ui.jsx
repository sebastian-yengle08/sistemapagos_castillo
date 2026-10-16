// Piezas visuales básicas reutilizables: botones, chips, insignias, ventanas, etc.
import { useEffect } from 'react'
import { Check, CheckCircle2, Clock, AlertCircle, X } from 'lucide-react'

/** Botón. variante: primario | secundario | peligro. Mínimo 48 px de alto. */
export function Boton({ variante = 'secundario', className = '', grande, children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors min-h-12 px-5 '
  const v = {
    primario: 'bg-brand text-white hover:bg-brand-dark active:bg-brand-darker',
    secundario: 'bg-white text-tinta border-[1.5px] border-borde hover:bg-slate-50 hover:border-slate-300',
    peligro: 'bg-venc-tx text-white hover:bg-red-800',
  }[variante]
  return (
    <button type="button" className={`${base}${v} ${grande ? 'min-h-14 text-lg w-full' : ''} ${className}`} {...props}>
      {children}
    </button>
  )
}

const ESTILOS_ESTADO = {
  Pendiente: { cls: 'bg-pend-bg text-pend-tx border-pend-bd', dot: 'bg-amber-600', Icono: Clock },
  Pagado: { cls: 'bg-pag-bg text-pag-tx border-pag-bd', dot: 'bg-emerald-600', Icono: CheckCircle2 },
  Vencido: { cls: 'bg-venc-bg text-venc-tx border-venc-bd', dot: 'bg-red-600', Icono: AlertCircle },
}
export const estiloEstado = (e) => ESTILOS_ESTADO[e]

/** Insignia de estado: color + punto + palabra. */
export function Insignia({ estado }) {
  const s = ESTILOS_ESTADO[estado]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-sm font-semibold ${s.cls}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {estado}
    </span>
  )
}

/** Chip seleccionable (tipo de recibo, medio de pago). */
export function Chip({ activo, onClick, children, nota }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={!!activo}
      onClick={onClick}
      className={`inline-flex min-h-12 items-center gap-1.5 rounded-xl px-4 text-base transition-colors ${
        activo ? 'border-[1.5px] border-brand bg-brand/10 font-bold text-brand' : 'border border-borde bg-white text-tinta hover:bg-slate-50'
      }`}
    >
      {activo && <Check size={18} aria-hidden="true" />}
      <span className="flex flex-col items-start leading-tight">
        {children}
        {nota && <span className="text-xs font-semibold text-pag-tx">{nota}</span>}
      </span>
    </button>
  )
}

/** Campo de formulario con etiqueta y mensaje de error. */
export function Campo({ etiqueta, id, error, ayuda, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-base font-semibold">
        {etiqueta}
      </label>
      {children}
      {ayuda && !error && <p className="mt-1 text-sm text-suave">{ayuda}</p>}
      {error && (
        <p role="alert" className="mt-1 flex items-center gap-1 text-sm font-semibold text-venc-tx">
          <AlertCircle size={16} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  )
}

export const claseInput = (error) =>
  `h-12 w-full rounded-xl border bg-white px-4 text-base outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 ${
    error ? 'border-venc-tx' : 'border-borde'
  }`

/** Ventana: centrada en escritorio, hoja inferior en celular. */
export function Ventana({ abierta, onCerrar, titulo, children, ancho = 'max-w-lg' }) {
  useEffect(() => {
    if (!abierta) return
    const alTecla = (e) => e.key === 'Escape' && onCerrar?.()
    window.addEventListener('keydown', alTecla)
    return () => window.removeEventListener('keydown', alTecla)
  }, [abierta, onCerrar])
  if (!abierta) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onCerrar?.()}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className={`subir max-h-[92vh] w-full ${ancho} overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6`}>
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="float-right -mr-1 -mt-1 rounded-full p-2 text-suave hover:bg-slate-100">
            <X size={22} />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

/** Estado vacío amable. */
export function Vacio({ icono: Icono, titulo, texto, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      {Icono && (
        <span className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand">
          <Icono size={28} aria-hidden="true" />
        </span>
      )}
      <p className="text-lg font-bold">{titulo}</p>
      {texto && <p className="max-w-xs text-suave">{texto}</p>}
      {children}
    </div>
  )
}

export function Tarjeta({ className = '', children, ...p }) {
  return (
    <div className={`rounded-2xl border border-borde bg-white shadow-[0_1px_3px_rgba(30,41,59,.04)] ${className}`} {...p}>
      {children}
    </div>
  )
}
