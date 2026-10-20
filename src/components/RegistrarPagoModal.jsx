// HU-03: ventana para registrar el pago, con los datos ya llenados y la FOTO DEL VOUCHER.
// Con modo="corregir" sirve para corregir un pago ya registrado (recibo Pagado).
import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, ImagePlus, Loader2 } from 'lucide-react'
import { Boton, Campo, Chip, Ventana, claseInput } from './ui'
import { MEDIOS } from '../config/constantes'
import { corregirPago, registrarPago, ultimoMedioDeEmpresa } from '../data/store'
import { subirVoucher } from '../data/persistencia'
import { comprimirImagen } from '../utils/imagen'
import { formatoFecha, hoyISO, inicioAnioISO } from '../utils/fechas'
import { formatoSoles, leerMonto } from '../utils/dinero'
import { soloMonto } from '../utils/validacion'
import { interesDePago } from '../utils/prestamos'

export default function RegistrarPagoModal({ recibo, modo = 'registrar', onCerrar }) {
  const corrigiendo = modo === 'corregir'
  const previo = corrigiendo ? recibo.pago : null
  // El último medio usado con esta empresa viene ya seleccionado (si existe)
  const [ultimo] = useState(() => (corrigiendo ? null : ultimoMedioDeEmpresa(recibo.empresa)))
  const esCuota = !!recibo.prestamoId
  // Mora/interés ya guardado: al corregir solo se muestra, no se modifica.
  const interesGuardado = previo ? interesDePago(previo, recibo.monto) : 0
  const [agregarInteres, setAgregarInteres] = useState(false)
  const [interes, setInteres] = useState('')
  const [fecha, setFecha] = useState(previo?.fecha ?? hoyISO())
  const [medio, setMedio] = useState(previo?.medio ?? ultimo)
  
  const [errores, setErrores] = useState({})
  const [listo, setListo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const hoy = hoyISO() // fecha de hoy en Lima: la fecha de pago no puede ser futura
  const inicioAnio = inicioAnioISO() // la fecha de pago no puede ser de un año anterior

  // Monto pagado = monto de la cuota/recibo + mora/interés. Siempre es calculado.
  const montoBase = Number(recibo.monto) || 0
  const interesTexto = agregarInteres ? interes.trim() : ''
  const interesNum = interesTexto === '' ? 0 : leerMonto(interesTexto)
  const interesValido = Number.isFinite(interesNum) && interesNum >= 0
  const totalPagado = corrigiendo
    ? Number(previo?.monto) || montoBase
    : Math.round((montoBase + (interesValido ? interesNum : 0)) * 100) / 100

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
  const vista = fotoNueva?.vista ?? fotoGuardada?.url ?? null

  async function confirmar() {
    const e = {}
    if (!(totalPagado > 0)) e.monto = 'El monto pagado debe ser mayor a cero.'
    else if (!corrigiendo && totalPagado < montoBase) e.monto = `El monto pagado no puede ser menor al monto ${esCuota ? 'de la cuota' : 'del recibo'} (S/ ${formatoSoles(montoBase)}).`
    if (agregarInteres && interesTexto !== '' && !Number.isFinite(interesNum)) e.interes = 'Escribe un monto válido para la mora o interés.'
    else if (agregarInteres && interesNum < 0) e.interes = 'La mora o interés no puede ser negativo.'
    if (!fecha) e.fecha = 'Elige la fecha de pago.'
    else if (fecha > hoy) e.fecha = 'La fecha de pago no puede ser posterior a hoy.'
    else if (fecha < inicioAnio) e.fecha = 'La fecha de pago no puede ser anterior al 1 de enero de este año.'
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
    const datos = { monto: totalPagado, interes: interesValido ? interesNum : 0, fecha, medio, foto: foto.url, fotoPath: foto.path }
    const resultado = corrigiendo ? corregirPago(recibo.id, datos) : registrarPago(recibo.id, datos)
    if (!resultado) {
      setErrores({ monto: 'No se pudo registrar el pago.' })
      setGuardando(false)
      return
    }
    setGuardando(false)
    setListo(true)
  }

  if (listo) {
    return (
      <Ventana abierta onCerrar={onCerrar} titulo={corrigiendo ? 'Pago corregido' : 'Pago registrado'}>
        <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-pag-bg text-pag-tx">
            <CheckCircle2 size={48} aria-hidden="true" />
          </span>
          <h2 className="text-2xl font-bold">{corrigiendo ? 'Pago corregido' : 'Pago registrado'}</h2>
          {corrigiendo && (
            <p className="text-suave">
              Los datos del pago de <b className="text-tinta">{recibo.empresa}</b> se actualizaron.
            </p>
          )}
          <Boton variante="primario" grande onClick={onCerrar}>
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
          <Campo
            etiqueta="Monto pagado"
            id="pago-monto"
            error={errores.monto}
            ayuda={corrigiendo ? 'El monto de un pago ya registrado no se puede modificar.' : esCuota ? 'Calculado automáticamente: cuota + mora/interés.' : 'Es el monto fijo del recibo.'}
          >
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-suave">S/</span>
              <input
                id="pago-monto"
                inputMode="decimal"
                value={totalPagado.toFixed(2)}
                disabled
                className={`${claseInput(errores.monto)} pl-11 bg-slate-900/[.05] cursor-not-allowed`}
              />
            </div>
          </Campo>
          <Campo etiqueta="Fecha de pago" id="pago-fecha" error={errores.fecha}>
            <input
              id="pago-fecha"
              type="date"
              min={inicioAnio}
              max={hoy}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={claseInput(errores.fecha)}
            />
          </Campo>
        </div>

        {esCuota && !corrigiendo && (
          <div className="rounded-2xl border border-borde p-4">
            <label className="flex cursor-pointer items-center gap-3 font-semibold">
              <input
                type="checkbox"
                checked={agregarInteres}
                onChange={(e) => setAgregarInteres(e.target.checked)}
                className="peer sr-only"
              />
              <span
                className={`relative inline-block h-7 w-12 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 ${agregarInteres ? 'bg-brand' : 'bg-slate-300'}`}
                aria-hidden="true"
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${agregarInteres ? 'left-6' : 'left-1'}`} />
              </span>
              Agregar mora/interés
            </label>
            {agregarInteres && (
              <div className="mt-4">
                <Campo
                  etiqueta="Mora o interés (opcional)"
                  id="pago-interes"
                  error={errores.interes}
                  ayuda="Se suma al monto de la cuota."
                >
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-suave">S/</span>
                    <input
                      id="pago-interes"
                      inputMode="decimal"
                      value={interes}
                      onChange={(e) => setInteres(soloMonto(e.target.value))}
                      placeholder="0.00"
                      className={`${claseInput(errores.interes)} pl-11`}
                    />
                  </div>
                </Campo>
              </div>
            )}
          </div>
        )}

        {corrigiendo && esCuota && interesGuardado > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/[.04] px-4 py-3">
            <span className="text-suave">Mora o interés registrado</span>
            <span className="font-semibold">{formatoSoles(interesGuardado)}</span>
          </div>
        )}

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
              <Boton onClick={() => galeria.current?.click()} className="flex-1 !min-h-11">
                Corregir foto
              </Boton>
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
