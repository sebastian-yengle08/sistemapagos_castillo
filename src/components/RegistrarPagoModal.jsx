// HU-03: ventana simple para registrar el pago, con los datos ya llenados.
// Flujo normal en 2 toques: "Registrar pago" y luego "Confirmar pago".
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Boton, Campo, Chip, Ventana, claseInput } from './ui'
import { MEDIOS } from '../config/constantes'
import { registrarPago, ultimoMedioDeEmpresa } from '../data/store'
import { formatoFecha, hoyISO } from '../utils/fechas'
import { formatoSoles, leerMonto } from '../utils/dinero'

export default function RegistrarPagoModal({ recibo, onCerrar }) {
  // El último medio usado con esta empresa viene ya seleccionado (si existe)
  const [ultimo] = useState(() => ultimoMedioDeEmpresa(recibo.empresa))
  const [monto, setMonto] = useState(String(recibo.monto.toFixed(2)))
  const [fecha, setFecha] = useState(hoyISO())
  const [medio, setMedio] = useState(ultimo)
  const [comprobante, setComprobante] = useState('')
  const [errores, setErrores] = useState({})
  const [listo, setListo] = useState(false)

  function confirmar() {
    const e = {}
    const m = leerMonto(monto)
    if (!(m > 0)) e.monto = 'Escribe un monto mayor a cero.'
    if (!fecha) e.fecha = 'Elige la fecha de pago.'
    if (!medio) e.medio = 'Elige cómo se pagó.'
    setErrores(e)
    if (Object.keys(e).length) return
    registrarPago(recibo.id, { monto: m, fecha, medio, comprobante })
    setListo(true)
  }

  if (listo) {
    return (
      <Ventana abierta onCerrar={onCerrar} titulo="Pago registrado">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-pag-bg text-pag-tx">
            <CheckCircle2 size={48} aria-hidden="true" />
          </span>
          <h2 className="text-2xl font-bold">Pago registrado</h2>
          <p className="text-suave">
            El recibo de <b className="text-tinta">{recibo.empresa}</b> ya figura como Pagado.
          </p>
          <Boton variante="primario" grande onClick={onCerrar} className="mt-4">
            Listo
          </Boton>
        </div>
      </Ventana>
    )
  }

  return (
    <Ventana abierta onCerrar={onCerrar} titulo="Registrar pago">
      <h2 className="text-2xl font-bold">Registrar pago</h2>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-brand/5 p-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{recibo.empresa}</p>
          <p className="text-sm text-suave">Vence {formatoFecha(recibo.fechaLimite)}</p>
        </div>
        <p className="text-xl font-bold text-brand">{formatoSoles(recibo.monto)}</p>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Monto pagado" id="pago-monto" error={errores.monto}>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-suave">S/</span>
              <input id="pago-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} className={`${claseInput(errores.monto)} pl-11`} />
            </div>
          </Campo>
          <Campo etiqueta="Fecha de pago" id="pago-fecha" error={errores.fecha}>
            <input id="pago-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput(errores.fecha)} />
          </Campo>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-base font-semibold">Medio de pago</legend>
          <div role="radiogroup" aria-label="Medio de pago" className="flex flex-wrap gap-2">
            {MEDIOS.map((m) => (
              <Chip key={m} activo={medio === m} onClick={() => setMedio(m)} nota={m === ultimo ? 'Usado la última vez' : null}>
                {m}
              </Chip>
            ))}
          </div>
          {errores.medio && (
            <p role="alert" className="mt-1 text-sm font-semibold text-venc-tx">
              {errores.medio}
            </p>
          )}
        </fieldset>

        <Campo etiqueta="Número de comprobante (opcional)" id="pago-comp">
          <input id="pago-comp" value={comprobante} onChange={(e) => setComprobante(e.target.value)} className={claseInput(false)} />
        </Campo>

        <Boton variante="primario" grande onClick={confirmar}>
          Confirmar pago
        </Boton>
      </div>
    </Ventana>
  )
}
