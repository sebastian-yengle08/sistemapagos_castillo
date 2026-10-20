// HU-01 Nuevo recibo, HU-04 Editar y HU-05 aviso de recibo repetido (solo asistente).
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Boton, Campo, Chip, Tarjeta, Ventana, claseInput } from '../components/ui'
import { TIPOS } from '../config/constantes'
import { buscarDuplicado, crearRecibo, editarRecibo, obtenerRecibo } from '../data/store'
import { formatoFecha, hoyISO, FECHA_MINIMA, FECHA_MAXIMA, fechaEnRango } from '../utils/fechas'
import { formatoSoles, leerMonto } from '../utils/dinero'
import { soloLetras, soloLetrasNumeros, soloMonto, soloCodigo, soloDigitos, soloCodigoProveedor } from '../utils/validacion'

// Cada tipo de recibo tiene su propio formato de código.
function limpiarCodigoDe(tipo, texto) {
  if (tipo === 'Servicio' || tipo === 'Impuesto') return soloDigitos(texto)
  if (tipo === 'Proveedor') return soloCodigoProveedor(texto)
  return soloCodigo(texto)
}

export default function ReciboFormPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  const editando = !!id
  const [consulta] = useSearchParams()
  const { state } = useLocation()
  const origen = state?.origen // pantalla de la que se vino (se conserva al volver al detalle)
  const hoy = hoyISO() // fecha de hoy en Lima
  const fechaMinima = FECHA_MINIMA // 1 de enero de 2026
  const fechaMaxima = FECHA_MAXIMA // 31 de diciembre de 2050
  const [original] = useState(() => (id ? obtenerRecibo(id) : null))
  // Los préstamos se registran en su propia sección (menú Préstamos), no como recibo suelto
  const tiposDisponibles = TIPOS.filter((t) => t !== 'Préstamo' || original?.tipo === 'Préstamo')

  const [tipo, setTipo] = useState(original?.tipo ?? '')
  const [empresa, setEmpresa] = useState(original?.empresa ?? '')
  const [codigo, setCodigo] = useState(original?.codigo ?? '')
  const [fecha, setFecha] = useState(() => {
    if (fechaEnRango(original?.fechaLimite)) return original.fechaLimite
    const deCalendario = consulta.get('fecha')
    return fechaEnRango(deCalendario) ? deCalendario : hoy
  })
  const [monto, setMonto] = useState(original ? original.monto.toFixed(2) : '')
  const [errores, setErrores] = useState({})
  const [duplicado, setDuplicado] = useState(null)

  // El campo cambia de nombre y de formato según el tipo de recibo
  const esProveedor = tipo === 'Proveedor'
  const esImpuesto = tipo === 'Impuesto'
  const etiquetaEmpresa = esProveedor ? 'Razón Social / RUC' : esImpuesto ? 'Entidad' : 'Empresa'
  const etiquetaFecha = esImpuesto ? 'Período tributario (fecha límite)' : 'Fecha límite'
  const placeholderEmpresa = esProveedor ? 'Ej.: Distribuidora ABC 20123456789' : esImpuesto ? 'Ej.: SUNAT, Municipalidad' : 'Ej.: SEDALIB'
  const ayudaEmpresa = esProveedor
    ? 'Solo letras, números y espacios. Si es RUC, debe tener 11 dígitos.'
    : 'Solo letras y signos de nombre. No se permiten números.'
  const limpiarEmpresa = esProveedor ? soloLetrasNumeros : soloLetras

  const ayudaCodigo = esProveedor
    ? 'Solo letras, números y guion medio (-).'
    : tipo === 'Servicio' || esImpuesto
      ? 'Solo números.'
      : 'Elige el tipo de recibo para validar el formato.'
  const placeholderCodigo = esProveedor ? 'Ej.: F001-0231' : 'Ej.: 55987'

  function elegirTipo(t) {
    setTipo(t)
    // Ajusta lo ya escrito al formato permitido por el nuevo tipo
    setEmpresa((v) => (t === 'Proveedor' ? soloLetrasNumeros(v) : soloLetras(v)))
    setCodigo((v) => limpiarCodigoDe(t, v))
  }

  // Las cuotas de préstamo y los recibos pagados no se editan
  if (editando && (!original || original.prestamoId || original.estado === 'Pagado')) {
    return (
      <Tarjeta className="mx-auto max-w-lg p-6 text-center">
        <p className="text-lg font-bold">{!original ? 'No encontramos este recibo' : original.prestamoId ? 'Las cuotas de un préstamo no se pueden editar' : 'Un recibo pagado no se puede editar'}</p>
        <p className="mt-1 text-suave">{!original ? 'Es posible que ya haya sido eliminado.' : original.prestamoId ? 'Solo se pagan o corrigen desde su detalle.' : 'Corrige el pago desde su detalle.'}</p>
        <Link to={original ? `/recibos/${id}` : '/'} replace state={{ origen }} className="mt-4 inline-flex min-h-12 items-center rounded-full bg-brand px-5 font-semibold text-white">
          Volver
        </Link>
      </Tarjeta>
    )
  }

  function validar() {
    const e = {}
    if (!tipo) e.tipo = 'Elige el tipo de recibo.'
    const nombreEmpresa = empresa.trim()
    if (!nombreEmpresa) e.empresa = esProveedor ? 'Escribe la razón social o el RUC.' : esImpuesto ? 'Escribe el nombre de la entidad.' : 'Escribe el nombre de la empresa.'
    else if (!/[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]/.test(nombreEmpresa)) e.empresa = 'Escribe un nombre válido.'
    else if (esProveedor && /^\d+$/.test(nombreEmpresa) && nombreEmpresa.length !== 11) {
      e.empresa = 'El RUC debe tener 11 dígitos.'
    }
    if (!codigo.trim()) e.codigo = 'Escribe el código del recibo.'
    else if ((tipo === 'Servicio' || esImpuesto) && !/^\d+$/.test(codigo.trim())) e.codigo = 'El código debe tener solo números.'
    else if (esProveedor && !/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ-]+$/.test(codigo.trim())) e.codigo = 'El código solo puede tener letras, números y guion medio.'
    else if (!/[a-zA-Z0-9]/.test(codigo)) e.codigo = 'Escribe un código válido.'
    if (!fecha) e.fecha = 'Elige la fecha límite de pago.'
    else if (fecha < fechaMinima) e.fecha = 'La fecha límite debe ser desde el 1 de enero de 2026.'
    else if (fecha > fechaMaxima) e.fecha = 'La fecha límite no puede ser posterior al 31 de diciembre de 2050.'
    const m = leerMonto(monto)
    if (monto.trim() === '') e.monto = 'Escribe el monto total.'
    else if (!(m > 0)) e.monto = 'Escribe un monto válido, mayor a cero.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  function guardar() {
    if (!validar()) return
    const datos = {
      tipo,
      empresa,
      codigo,
      fechaLimite: fecha,
      monto: leerMonto(monto),
    }
    // El código de comprobante es único: no se puede repetir en otro recibo.
    const previo = buscarDuplicado(codigo, editando ? id : null)
    if (previo) return setDuplicado(previo)
    if (editando) {
      const editado = editarRecibo(id, datos)
      if (!editado) return setErrores({ fecha: 'La fecha límite debe estar entre el 1 de enero de 2026 y el 31 de diciembre de 2050.' })
      navegar(`/recibos/${id}`, { replace: true, state: { origen, aviso: 'Cambios guardados' } })
      return
    }
    const nuevo = crearRecibo(datos)
    if (!nuevo) return setErrores({ fecha: 'La fecha límite debe estar entre el 1 de enero de 2026 y el 31 de diciembre de 2050.' })
    navegar('/', { replace: true, state: { aviso: `Recibo guardado: ${nuevo.empresa}` } })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={editando ? `/recibos/${id}` : '/'} replace state={{ origen }} className="mb-3 inline-flex min-h-12 items-center gap-1 font-semibold text-brand">
        <ArrowLeft size={20} aria-hidden="true" /> Volver
      </Link>
      <h1 className="text-2xl font-bold sm:text-3xl">{editando ? 'Editar recibo' : 'Nuevo recibo'}</h1>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          guardar()
        }}
        className="mt-5 flex flex-col gap-5 rounded-2xl border border-borde bg-sup p-4 sm:p-6"
      >
        <fieldset>
          <legend className="mb-1.5 text-base font-semibold">Tipo de recibo</legend>
          <div role="radiogroup" aria-label="Tipo de recibo" className="flex flex-wrap gap-2">
            {tiposDisponibles.map((t) => (
              <Chip key={t} activo={tipo === t} onClick={() => elegirTipo(t)}>
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

        <Campo etiqueta={etiquetaEmpresa} id="f-empresa" error={errores.empresa} ayuda={ayudaEmpresa}>
          <input id="f-empresa" value={empresa} onChange={(e) => setEmpresa(limpiarEmpresa(e.target.value))} placeholder={placeholderEmpresa} className={claseInput(errores.empresa)} />
        </Campo>
        <Campo etiqueta="Código del recibo" id="f-codigo" error={errores.codigo} ayuda={ayudaCodigo}>
          <input
            id="f-codigo"
            inputMode={tipo === 'Servicio' || esImpuesto ? 'numeric' : 'text'}
            value={codigo}
            onChange={(e) => setCodigo(limpiarCodigoDe(tipo, e.target.value))}
            placeholder={placeholderCodigo}
            className={claseInput(errores.codigo)}
          />
        </Campo>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta={etiquetaFecha} id="f-fecha" error={errores.fecha}>
            <input id="f-fecha" type="date" min={fechaMinima} max={fechaMaxima} value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput(errores.fecha)} />
          </Campo>
          <Campo etiqueta="Monto total" id="f-monto" error={errores.monto}>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-suave">S/</span>
              <input id="f-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(soloMonto(e.target.value))} placeholder="0.00" className={`${claseInput(errores.monto)} pl-11`} />
            </div>
          </Campo>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Boton onClick={() => navegar(editando ? `/recibos/${id}` : '/', { replace: true, state: { origen } })}>Cancelar</Boton>
          <Boton variante="primario" type="submit" className="sm:min-w-56">
            {editando ? 'Guardar cambios' : 'Guardar recibo'}
          </Boton>
        </div>
      </form>

      {/* HU-05: aviso de recibo repetido */}
      <Ventana abierta={!!duplicado} onCerrar={() => setDuplicado(null)} titulo="Este código ya está registrado">
        {duplicado && (
          <>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pend-bg text-pend-tx">
                <AlertTriangle size={26} aria-hidden="true" />
              </span>
              <h2 className="text-xl font-bold">Este código ya está registrado</h2>
            </div>
            <p className="mt-3 text-suave">Ya existe un recibo con el mismo código:</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl bg-slate-900/[.04] p-4">
              <dt className="text-suave">{duplicado.tipo === 'Proveedor' ? 'Razón Social / RUC' : duplicado.tipo === 'Impuesto' ? 'Entidad' : 'Empresa'}</dt>
              <dd className="font-semibold">{duplicado.empresa}</dd>
              <dt className="text-suave">Código</dt>
              <dd className="font-semibold">{duplicado.codigo}</dd>
              <dt className="text-suave">Fecha límite</dt>
              <dd className="font-semibold">{formatoFecha(duplicado.fechaLimite)}</dd>
              <dt className="text-suave">Monto</dt>
              <dd className="font-semibold">{formatoSoles(duplicado.monto)}</dd>
            </dl>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Boton variante="primario" onClick={() => setDuplicado(null)}>
                Entendido
              </Boton>
            </div>
          </>
        )}
      </Ventana>
    </div>
  )
}
