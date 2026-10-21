// Detalle de un recibo.
// Asistente: Pendiente/Vencido → registrar pago, editar, eliminar. Pagado → corregir el pago.
// Cuotas de préstamo: no se editan ni eliminan. Gerente: solo consulta.
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Pencil, Trash2, Wallet, FileX, Banknote, ZoomIn } from 'lucide-react'
import { useDatos } from '../data/useDatos'
import { useAuth } from '../context/AuthContext'
import { cuotaPendienteAnterior, eliminarRecibo, pagosBloqueados } from '../data/store'
import { urlFotoValida } from '../data/persistencia'
import { Boton, Insignia, Tarjeta, Ventana, Vacio } from '../components/ui'
import RegistrarPagoModal from '../components/RegistrarPagoModal'
import { iconoDeTipo } from '../components/ReciboFila'
import { estadoVisible } from '../utils/estado'
import { diasEntre, formatoFecha, hoyISO } from '../utils/fechas'
import { formatoSoles } from '../utils/dinero'
import { interesCuota } from '../utils/prestamos'

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
  const [verFoto, setVerFoto] = useState(false) // foto del voucher en grande

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
  const bloqueado = pagosBloqueados() // el gerente bloqueó los pagos
  const cuotaPrevia = !pagado ? cuotaPendienteAnterior(r) : null // las cuotas se pagan en orden
  const interes = esCuota ? interesCuota(r) : 0
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
          <Dato etiqueta={r.tipo === 'Impuesto' ? 'Período tributario' : 'Fecha límite'}>{formatoFecha(r.fechaLimite)}</Dato>
          <Dato etiqueta="Tipo">{r.tipo}</Dato>
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
            {esCuota && <Dato etiqueta="Monto de la cuota">{formatoSoles(r.monto)}</Dato>}
            {esCuota && interes > 0 && <Dato etiqueta="Mora o interés">{formatoSoles(interes)}</Dato>}
            <Dato etiqueta="Monto pagado">{formatoSoles(r.pago.monto)}</Dato>
            <Dato etiqueta="Medio de pago">{r.pago.medio}</Dato>
            <Dato etiqueta="Fecha de pago">{formatoFecha(r.pago.fecha)}</Dato>
          </dl>
          {/* Foto del voucher: se ve igual para asistente y gerente */}
          <div className="mt-3">
            <p className="mb-1.5 text-sm font-semibold text-suave">Foto del voucher</p>
            {r.pago.foto && urlFotoValida(r.pago.foto) ? (
              <button type="button" onClick={() => setVerFoto(true)} className="group relative block overflow-hidden rounded-2xl border border-borde" aria-label="Ver la foto del voucher en grande">
                <img src={r.pago.foto} alt="Voucher del pago" loading="lazy" className="h-40 w-full max-w-xs object-cover transition group-hover:opacity-90" />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-900/60 py-1 text-sm font-semibold text-white">
                  <ZoomIn size={16} aria-hidden="true" /> Ver en grande
                </span>
              </button>
            ) : (
              <p className="rounded-xl bg-slate-900/[.04] p-3 text-sm text-suave">{r.pago.foto ? 'La dirección de la foto no es válida.' : 'Este pago se registró sin foto del voucher.'}</p>
            )}
          </div>
        </Tarjeta>
      )}

      {/* Acciones del asistente según el estado */}
      {esAsistente && (
        <div className="mt-5 flex flex-col gap-3">
          {!pagado && cuotaPrevia && (
            <p className="flex items-center gap-2 rounded-xl border border-pend-bd bg-pend-bg p-3 text-sm font-semibold text-pend-tx">
              <Banknote size={18} aria-hidden="true" /> Primero hay que pagar la cuota {cuotaPrevia} de este préstamo.
            </p>
          )}
          {!pagado && !cuotaPrevia && !bloqueado && (
            <Boton variante="primario" grande onClick={() => setPagando(true)}>
              <Wallet size={22} aria-hidden="true" /> Registrar pago
            </Boton>
          )}

          {pagado && !bloqueado && (
            <Boton onClick={() => setCorrigiendo(true)}>
              <Pencil size={18} aria-hidden="true" /> Corregir pago
            </Boton>
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
              <Banknote size={18} aria-hidden="true" /> Esta cuota viene de un préstamo: solo se puede pagar o corregir su pago.
            </p>
          )}
          {pagado && !esCuota && <p className="text-sm text-suave">Un recibo pagado no se puede eliminar.</p>}
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

      {r.pago?.foto && urlFotoValida(r.pago.foto) && (
        <Ventana abierta={verFoto} onCerrar={() => setVerFoto(false)} titulo="Foto del voucher" ancho="max-w-2xl">
          <h2 className="mb-3 pr-10 text-xl font-bold">Voucher de {r.empresa}</h2>
          <img src={r.pago.foto} alt="Voucher del pago" className="max-h-[70vh] w-full rounded-2xl object-contain" />
          <a href={r.pago.foto} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center font-semibold text-brand underline">
            Abrir imagen en otra pestaña
          </a>
        </Ventana>
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

    </div>
  )
}
