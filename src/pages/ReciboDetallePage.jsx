// Detalle de un recibo.
// Asistente: Pendiente/Vencido → registrar pago, editar, eliminar. Pagado → corregir o anular el pago.
// Cuotas de préstamo: no se editan ni eliminan. Gerente: solo consulta.
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Pencil, Trash2, Wallet, FileX, Banknote, Undo2 } from 'lucide-react'
import { useDatos } from '../data/useDatos'
import { useAuth } from '../context/AuthContext'
import { anularPago, eliminarRecibo } from '../data/store'
import { Boton, Insignia, Tarjeta, Ventana, Vacio } from '../components/ui'
import RegistrarPagoModal from '../components/RegistrarPagoModal'
import { iconoDeTipo } from '../components/ReciboFila'
import { estadoVisible } from '../utils/estado'
import { diasEntre, formatoFecha, hoyISO } from '../utils/fechas'
import { formatoSoles } from '../utils/dinero'

function Dato({ etiqueta, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-borde py-3 last:border-0">
      <dt className="text-suave">{etiqueta}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}

export default function ReciboDetallePage() {
  const { id } = useParams()
  const { recibos } = useDatos()
  const { perfil } = useAuth()
  const navegar = useNavigate()
  const { state } = useLocation()
  const [pagando, setPagando] = useState(false)
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [anulando, setAnulando] = useState(false)

  // Pantalla de la que se vino (calendario, avisos, préstamo, historial); por defecto el calendario
  const origen = state?.origen ?? '/'
  const volver = () => navegar(origen, { replace: true })
  // Recarga este mismo detalle reemplazando la entrada actual (no agrega historial del navegador)
  const recargarDetalle = (aviso) => navegar(`/recibos/${id}`, { replace: true, state: { origen, aviso } })

  const r = recibos.find((x) => x.id === id)
  if (!r) {
    return (
      <div className="mx-auto max-w-lg">
        <Vacio icono={FileX} titulo="No encontramos este recibo" texto="Es posible que ya haya sido eliminado.">
          <Link to="/" replace className="mt-3 inline-flex min-h-12 items-center rounded-full bg-brand px-5 font-semibold text-white">
            Ir al calendario
          </Link>
        </Vacio>
      </div>
    )
  }

  const hoy = hoyISO()
  const estado = estadoVisible(r, hoy)
  const Icono = iconoDeTipo(r.tipo)
  const esAsistente = perfil === 'asistente'
  const esCuota = !!r.prestamoId
  const pagado = r.estado === 'Pagado'
  const dias = diasEntre(hoy, r.fechaLimite)
  const nota = estado === 'Vencido' ? `Venció hace ${-dias} ${-dias === 1 ? 'día' : 'días'}` : estado === 'Pendiente' ? (dias === 0 ? 'Vence hoy' : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`) : null

  return (
    <div className="mx-auto max-w-2xl">
      <button type="button" onClick={volver} className="mb-3 inline-flex min-h-12 items-center gap-1 font-semibold text-brand">
        <ArrowLeft size={20} aria-hidden="true" /> Volver
      </button>

      {state?.aviso && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-pag-bd bg-pag-bg px-4 py-3 font-semibold text-pag-tx">
          <CheckCircle2 size={20} aria-hidden="true" /> {state.aviso}
        </p>
      )}

      <Tarjeta className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Icono size={28} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{r.empresa}</h1>
            <p className="text-suave">
              {r.tipo} · {r.codigo}
            </p>
          </div>
          <Insignia estado={estado} />
        </div>

        <p className="mt-5 text-4xl font-bold tracking-tight">{formatoSoles(r.monto)}</p>
        {nota && <p className={`mt-1 font-semibold ${estado === 'Vencido' ? 'text-venc-tx' : 'text-pend-tx'}`}>{nota}</p>}

        <dl className="mt-4">
          <Dato etiqueta="Fecha límite">{formatoFecha(r.fechaLimite)}</Dato>
          <Dato etiqueta="Tipo">{r.tipo}</Dato>
          {r.igv != null && <Dato etiqueta="IGV">{formatoSoles(r.igv)}</Dato>}
          {esCuota && <Dato etiqueta="Cuota de préstamo">{r.cuota}</Dato>}
        </dl>
      </Tarjeta>

      {/* Pago realizado (con la fecha real de pago) */}
      {r.pago && (
        <Tarjeta className="mt-4 border-pag-bd bg-pag-bg/40 p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-pag-tx">
            <CheckCircle2 size={22} aria-hidden="true" /> Pago realizado
          </h2>
          <dl className="mt-2">
            <Dato etiqueta="Monto pagado">{formatoSoles(r.pago.monto)}</Dato>
            <Dato etiqueta="Medio de pago">{r.pago.medio}</Dato>
            <Dato etiqueta="Fecha de pago">{formatoFecha(r.pago.fecha)}</Dato>
            {r.pago.comprobante && <Dato etiqueta="Comprobante">{r.pago.comprobante}</Dato>}
          </dl>
        </Tarjeta>
      )}

      {/* Acciones del asistente según el estado */}
      {esAsistente && (
        <div className="mt-5 flex flex-col gap-3">
          {!pagado && (
            <Boton variante="primario" grande onClick={() => setPagando(true)}>
              <Wallet size={22} aria-hidden="true" /> Registrar pago
            </Boton>
          )}

          {pagado && (
            <div className="grid grid-cols-2 gap-3">
              <Boton onClick={() => setCorrigiendo(true)}>
                <Pencil size={18} aria-hidden="true" /> Corregir pago
              </Boton>
              <Boton onClick={() => setAnulando(true)} className="!text-venc-tx">
                <Undo2 size={18} aria-hidden="true" /> Anular pago
              </Boton>
            </div>
          )}

          {!pagado && !esCuota && (
            <div className="grid grid-cols-2 gap-3">
              <Boton onClick={() => navegar(`/recibos/${r.id}/editar`, { state: { origen } })}>
                <Pencil size={18} aria-hidden="true" /> Editar
              </Boton>
              <Boton onClick={() => setEliminando(true)} className="!text-venc-tx">
                <Trash2 size={18} aria-hidden="true" /> Eliminar
              </Boton>
            </div>
          )}

          {esCuota && (
            <p className="flex items-center gap-2 rounded-xl bg-slate-900/[.05] p-3 text-sm text-suave">
              <Banknote size={18} aria-hidden="true" /> Esta cuota viene de un préstamo: solo se puede pagar, corregir o anular su pago.
            </p>
          )}
          {pagado && !esCuota && <p className="text-sm text-suave">Para eliminar este recibo, primero anula el pago.</p>}
        </div>
      )}

      {pagando && (
        <RegistrarPagoModal
          recibo={r}
          onCerrar={() => {
            setPagando(false)
            recargarDetalle()
          }}
        />
      )}
      {corrigiendo && (
        <RegistrarPagoModal
          recibo={r}
          modo="corregir"
          onCerrar={() => {
            setCorrigiendo(false)
            recargarDetalle()
          }}
        />
      )}

      <Ventana abierta={eliminando} onCerrar={() => setEliminando(false)} titulo="Eliminar recibo">
        <h2 className="text-xl font-bold">¿Está seguro de eliminar este recibo?</h2>
        <p className="mt-2 text-suave">
          Se eliminará el recibo de <b className="text-tinta">{r.empresa}</b> por {formatoSoles(r.monto)}. Esta acción no se puede deshacer.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Boton onClick={() => setEliminando(false)}>Cancelar</Boton>
          <Boton
            variante="peligro"
            onClick={() => {
              eliminarRecibo(r.id)
              navegar('/', { replace: true })
            }}
          >
            Sí, eliminar
          </Boton>
        </div>
      </Ventana>

      <Ventana abierta={anulando} onCerrar={() => setAnulando(false)} titulo="Anular pago">
        <h2 className="text-xl font-bold">¿Anular este pago?</h2>
        <p className="mt-2 text-suave">El recibo volverá a Pendiente. Luego se puede registrar el pago de nuevo.</p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Boton onClick={() => setAnulando(false)}>Cancelar</Boton>
          <Boton
            variante="peligro"
            onClick={() => {
              anularPago(r.id)
              setAnulando(false)
              recargarDetalle('Pago anulado')
            }}
          >
            Sí, anular pago
          </Boton>
        </div>
      </Ventana>
    </div>
  )
}
