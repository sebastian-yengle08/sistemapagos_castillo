// HU-01 Nuevo recibo, HU-04 Editar y HU-05 aviso de recibo repetido (solo asistente).
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Boton, Campo, Chip, Tarjeta, Ventana, claseInput } from '../components/ui'
import { TIPOS } from '../config/constantes'
import { buscarDuplicado, crearRecibo, editarRecibo, obtenerRecibo } from '../data/store'
import { formatoFecha, hoyISO } from '../utils/fechas'
import { formatoSoles, leerMonto } from '../utils/dinero'

export default function ReciboFormPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  const editando = !!id
  const [original] = useState(() => (id ? obtenerRecibo(id) : null))

  const [tipo, setTipo] = useState(original?.tipo ?? '')
  const [empresa, setEmpresa] = useState(original?.empresa ?? '')
  const [codigo, setCodigo] = useState(original?.codigo ?? '')
  const [fecha, setFecha] = useState(original?.fechaLimite ?? hoyISO())
  const [monto, setMonto] = useState(original ? original.monto.toFixed(2) : '')
  const [igv, setIgv] = useState(original?.igv != null ? original.igv.toFixed(2) : '')
  const [errores, setErrores] = useState({})
  const [duplicado, setDuplicado] = useState(null)

  // Las cuotas de préstamo no se editan: solo se pagan
  if (editando && (!original || original.prestamoId)) {
    return (
      <Tarjeta className="mx-auto max-w-lg p-6 text-center">
        <p className="text-lg font-bold">{original ? 'Las cuotas de un préstamo no se pueden editar' : 'No encontramos este recibo'}</p>
        <p className="mt-1 text-suave">{original ? 'Solo se pagan desde su detalle.' : 'Es posible que ya haya sido eliminado.'}</p>
        <Link to={original ? `/recibos/${id}` : '/'} className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-semibold text-white">
          Volver
        </Link>
      </Tarjeta>
    )
  }

  function validar() {
    const e = {}
    if (!tipo) e.tipo = 'Elige el tipo de recibo.'
    if (!empresa.trim()) e.empresa = 'Escribe el nombre de la empresa.'
    if (!codigo.trim()) e.codigo = 'Escribe el código del recibo.'
    if (!fecha) e.fecha = 'Elige la fecha límite de pago.'
    const m = leerMonto(monto)
    if (monto.trim() === '') e.monto = 'Escribe el monto total.'
    else if (!(m > 0)) e.monto = 'Escribe un monto válido, mayor a cero.'
    if (igv.trim() !== '' && !(leerMonto(igv) >= 0)) e.igv = 'Escribe un IGV válido o déjalo vacío.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  function guardar(forzar = false) {
    if (!validar()) return
    const datos = { tipo, empresa, codigo, fechaLimite: fecha, monto: leerMonto(monto), igv: igv.trim() === '' ? null : leerMonto(igv) }
    if (editando) {
      editarRecibo(id, datos)
      navegar(`/recibos/${id}`, { state: { aviso: 'Cambios guardados' } })
      return
    }
    if (!forzar) {
      const previo = buscarDuplicado(empresa, codigo)
      if (previo) return setDuplicado(previo) // HU-05: avisa, pero no bloquea
    }
    const nuevo = crearRecibo(datos)
    navegar(`/recibos/${nuevo.id}`, { state: { aviso: 'Recibo guardado' } })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={editando ? `/recibos/${id}` : '/'} className="mb-3 inline-flex min-h-12 items-center gap-1 font-semibold text-brand">
        <ArrowLeft size={20} aria-hidden="true" /> Volver
      </Link>
      <h1 className="text-2xl font-bold sm:text-3xl">{editando ? 'Editar recibo' : 'Nuevo recibo'}</h1>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
        className="mt-5 flex flex-col gap-5 rounded-2xl border border-borde bg-white p-4 sm:p-6"
      >
        <fieldset>
          <legend className="mb-1.5 text-base font-semibold">Tipo de recibo</legend>
          <div role="radiogroup" aria-label="Tipo de recibo" className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <Chip key={t} activo={tipo === t} onClick={() => setTipo(t)}>
                {t}
              </Chip>
            ))}
          </div>
          {errores.tipo && (
            <p role="alert" className="mt-1 text-sm font-semibold text-venc-tx">
              {errores.tipo}
            </p>
          )}
        </fieldset>

        <Campo etiqueta="Empresa" id="f-empresa" error={errores.empresa}>
          <input id="f-empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Ej.: SEDALIB" className={claseInput(errores.empresa)} />
        </Campo>
        <Campo etiqueta="Código del recibo" id="f-codigo" error={errores.codigo}>
          <input id="f-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej.: SED-55987" className={claseInput(errores.codigo)} />
        </Campo>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta="Fecha límite" id="f-fecha" error={errores.fecha}>
            <input id="f-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput(errores.fecha)} />
          </Campo>
          <Campo etiqueta="Monto total" id="f-monto" error={errores.monto}>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-suave">S/</span>
              <input id="f-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" className={`${claseInput(errores.monto)} pl-11`} />
            </div>
          </Campo>
        </div>
        <Campo etiqueta="IGV (opcional)" id="f-igv" error={errores.igv} ayuda="Solo si quieres dejarlo anotado.">
          <div className="relative sm:max-w-[50%]">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-suave">S/</span>
            <input id="f-igv" inputMode="decimal" value={igv} onChange={(e) => setIgv(e.target.value)} placeholder="0.00" className={`${claseInput(errores.igv)} pl-11`} />
          </div>
        </Campo>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Boton onClick={() => navegar(editando ? `/recibos/${id}` : '/')}>Cancelar</Boton>
          <Boton variante="primario" type="submit" className="sm:min-w-56">
            {editando ? 'Guardar cambios' : 'Guardar recibo'}
          </Boton>
        </div>
      </form>

      {/* HU-05: aviso de recibo repetido */}
      <Ventana abierta={!!duplicado} onCerrar={() => setDuplicado(null)} titulo="Este recibo parece repetido">
        {duplicado && (
          <>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pend-bg text-pend-tx">
                <AlertTriangle size={26} aria-hidden="true" />
              </span>
              <h2 className="text-xl font-bold">Este recibo parece repetido</h2>
            </div>
            <p className="mt-3 text-suave">Ya existe un recibo con la misma empresa y el mismo código:</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-slate-50 p-4">
              <dt className="text-suave">Empresa</dt>
              <dd className="font-semibold">{duplicado.empresa}</dd>
              <dt className="text-suave">Código</dt>
              <dd className="font-semibold">{duplicado.codigo}</dd>
              <dt className="text-suave">Fecha límite</dt>
              <dd className="font-semibold">{formatoFecha(duplicado.fechaLimite)}</dd>
              <dt className="text-suave">Monto</dt>
              <dd className="font-semibold">{formatoSoles(duplicado.monto)}</dd>
            </dl>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Boton onClick={() => setDuplicado(null)}>Cancelar</Boton>
              <Boton
                variante="primario"
                onClick={() => {
                  setDuplicado(null)
                  guardar(true)
                }}
              >
                Guardar de todos modos
              </Boton>
            </div>
          </>
        )}
      </Ventana>
    </div>
  )
}
