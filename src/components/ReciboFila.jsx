import { Link } from 'react-router-dom'
import { Zap, Truck, Landmark, FileText, ChevronRight } from 'lucide-react'
import { Insignia } from './ui'
import { estadoVisible } from '../utils/estado'
import { formatoFecha } from '../utils/fechas'
import { formatoSoles } from '../utils/dinero'

const ICONOS = { Servicio: Zap, Proveedor: Truck, Impuesto: FileText, Préstamo: Landmark }
export const iconoDeTipo = (tipo) => ICONOS[tipo] ?? FileText

/** Tarjeta de un recibo: empresa, código, fecha límite, monto y estado. Al tocarla abre el detalle. */
export default function ReciboFila({ recibo, hoy, compacta }) {
  const estado = estadoVisible(recibo, hoy)
  const Icono = iconoDeTipo(recibo.tipo)
  const colorIcono = estado === 'Vencido' ? 'bg-venc-bg text-venc-tx' : estado === 'Pagado' ? 'bg-pag-bg text-pag-tx' : 'bg-brand/10 text-brand'
  return (
    <Link
      to={`/recibos/${recibo.id}`}
      className={`flex items-center gap-3 rounded-2xl border bg-white p-3 transition-shadow hover:shadow-md sm:p-4 ${estado === 'Vencido' ? 'border-venc-bd' : 'border-borde'}`}
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${colorIcono}`}>
        <Icono size={22} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold">{recibo.empresa}</span>
        <span className="block truncate text-sm text-suave">
          {recibo.codigo} · Vence {formatoFecha(recibo.fechaLimite)}
        </span>
        {compacta && (
          <span className="mt-1 flex items-center gap-2">
            <Insignia estado={estado} />
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-base font-bold">{formatoSoles(recibo.monto)}</span>
        {!compacta && <Insignia estado={estado} />}
      </span>
      <ChevronRight size={20} className="hidden shrink-0 text-slate-400 sm:block" aria-hidden="true" />
    </Link>
  )
}
