// HU-03: ventana para registrar el pago, con los datos ya llenados y la FOTO DEL VOUCHER.
// Con modo="corregir" sirve para corregir un pago ya registrado (recibo Pagado).
import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, ImagePlus, Loader2, X } from 'lucide-react'
import { Boton, Campo, Chip, Ventana, claseInput } from './ui'
import { MEDIOS } from '../config/constantes'
import { corregirPago, registrarPago, ultimoMedioDeEmpresa } from '../data/store'
import { subirVoucher } from '../data/persistencia'
import { comprimirImagen } from '../utils/imagen'
import { formatoFecha, hoyISO } from '../utils/fechas'
import { formatoSoles, leerMonto } from '../utils/dinero'

export default function RegistrarPagoModal({ recibo, modo = 'registrar', onCerrar }) {
  const corrigiendo = modo === 'corregir'
  const previo = corrigiendo ? recibo.pago : null
  // El último medio usado con esta empresa viene ya seleccionado (si existe)
  const [ultimo] = useState(() => (corrigiendo ? null : ultimoMedioDeEmpresa(recibo.empresa)))
  const [monto, setMonto] = useState((previo?.monto ?? recibo.monto).toFixed(2))
  const [fecha, setFecha] = useState(previo?.fecha ?? hoyISO())
  const [medio, setMedio] = useState(previo?.medio ?? ultimo)
  const [comprobante, setComprobante] = useState(previo?.comprobante ?? '')
  const [errores, setErrores] = useState({})
  const [listo, setListo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const hoy = hoyISO() // fecha de hoy en Lima: la fecha de pago no puede ser futura

  // Foto del voucher: la ya guardada (al corregir) o una nueva elegida ahora (se sube al confirmar)
  const [fotoGuardada, setFotoGuardada] = useState(previo?.foto ? { url: previo.foto, path: previo.fotoPath ?? null } : null)
  const [fotoNueva, setFotoNueva] = useState(null) // { blob, vista }
  const [procesando, setProcesando] = useState(false)
  const camara = useRef(null)
  const galeria = useRef(null)
  useEffect(() => () => fotoNueva && URL.revokeObjectURL(fotoNueva.vista), [fotoNueva])

  async function elegirFoto(e) {
    const archivo = e.target.files?.[0]
    e.target.value = '' // permite elegir la misma foto otra vez
    if (!archivo) return
    if (!archivo.type.startsWith('image/')) return setErrores((x) => ({ ...x, foto: 'El archivo debe ser una imagen (foto).' }))
    setProcesando(true)
    try {
      const blob = await comprimirImagen(archivo)
      setFotoNueva({ blob, vista: URL.createObjectURL(blob) })
      setErrores((x) => ({ ...x, foto: undefined }))
    } catch {
      setErrores((x) => ({ ...x, foto: 'No se pudo leer esa foto. Prueba con otra.' }))
    }
    setProcesando(false)
  }
  const quitarFoto = () => {
    setFotoNueva(null)
    setFotoGuardada(null)
  }
  const vista = fotoNueva?.vista ?? fotoGuardada?.url ?? null

  async function confirmar() {
    const e = {}
    const m = leerMonto(monto)
    if (!(m > 0)) e.monto = 'Escribe un monto mayor a cero.'
    if (!fecha) e.fecha = 'Elige la fecha de pago.'
    else if (fecha > hoy) e.fecha = 'La fecha de pago no puede ser futura'
    if (!medio) e.medio = 'Elige cómo se pagó.'
    if (!vista) e.foto = 'Sube la foto del voucher.'
    setErrores(e)
    if (Object.keys(e).length) return

    setGuardando(true)
    let foto = fotoGuardada
    try {
      if (fotoNueva) foto = await subirVoucher(fotoNueva.blob)
    } catch {
      setErrores({ foto: 'No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.' })
      setGuardando(false)
      return
    }
    const datos = { monto: m, fecha, medio, comprobante, foto: foto.url, fotoPath: foto.path }
    if (corrigiendo) corregirPago(recibo.id, datos)
    else registrarPago(recibo.id, datos)
    setGuardando(false)
    setListo(true)
  }

  if (listo) {
    return (
      <Ventana abierta onCerrar={onCerrar} titulo={corrigiendo ? 'Pago corregido' : 'Pago registrado'}>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-pag-bg text-pag-tx">
            <CheckCircle2 size={48} aria-hidden="true" />
          </span>
          <h2 className="text-2xl font-bold">{corrigiendo ? 'Pago corregido' : 'Pago registrado'}</h2>
          <p className="text-suave">
            {corrigiendo ? (
              <>Los datos del pago de <b className="text-tinta">{recibo.empresa}</b> se actualizaron.</>
            ) : (
              <>El recibo de <b className="text-tinta">{recibo.empresa}</b> ya figura como Pagado.</>
            )}
          </p>
          <Boton variante="primario" grande onClick={onCerrar} className="mt-4">
            Listo
          </Boton>
        </div>
      </Ventana>
    )
  }

  return (
    <Ventana abierta onCerrar={guardando ? undefined : onCerrar} titulo={corrigiendo ? 'Corregir pago' : 'Registrar pago'}>
      <h2 className="text-2xl font-bold">{corrigiendo ? 'Corregir pago' : 'Registrar pago'}</h2>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-brand/10 p-4">
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
            <input id="pago-fecha" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput(errores.fecha)} />
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

        {/* Foto del voucher (obligatoria) */}
        <div>
          <p className="mb-1.5 text-base font-semibold" id="lbl-foto">
            Foto del voucher
          </p>
          <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={elegirFoto} aria-labelledby="lbl-foto" />
          <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={elegirFoto} aria-labelledby="lbl-foto" />
          {vista ? (
            <div className="flex items-center gap-3 rounded-2xl border border-borde bg-slate-900/[.03] p-3">
              <img src={vista} alt="Foto del voucher" className="h-24 w-24 shrink-0 rounded-xl border border-borde object-cover" />
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                <Boton onClick={() => galeria.current?.click()} className="!min-h-11 flex-1">
                  Cambiar foto
                </Boton>
                <Boton onClick={quitarFoto} className="!min-h-11 flex-1 !text-venc-tx">
                  <X size={16} aria-hidden="true" /> Quitar
                </Boton>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Boton onClick={() => camara.current?.click()} disabled={procesando}>
                {procesando ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />} Tomar foto
              </Boton>
              <Boton onClick={() => galeria.current?.click()} disabled={procesando}>
                <ImagePlus size={18} aria-hidden="true" /> Elegir imagen
              </Boton>
            </div>
          )}
          {errores.foto && (
            <p role="alert" className="mt-1 text-sm font-semibold text-venc-tx">
              {errores.foto}
            </p>
          )}
        </div>

        <Campo etiqueta="Número de comprobante (opcional)" id="pago-comp">
          <input id="pago-comp" value={comprobante} onChange={(e) => setComprobante(e.target.value)} className={claseInput(false)} />
        </Campo>

        <Boton variante="primario" grande onClick={confirmar} disabled={guardando || procesando}>
          {guardando ? (
            <>
              <Loader2 size={20} className="animate-spin" aria-hidden="true" /> Guardando…
            </>
          ) : corrigiendo ? (
            'Guardar corrección'
          ) : (
            'Confirmar pago'
          )}
        </Boton>
      </div>
    </Ventana>
  )
}
