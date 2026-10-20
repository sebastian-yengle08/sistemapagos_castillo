// HU-01 Nuevo recibo, HU-04 Editar y HU-05 aviso de recibo repetido (solo asistente).
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Boton, Campo, Chip, Tarjeta, Ventana, claseInput } from '../components/ui'
import { TIPOS, LIMITE_MONTO, NOMBRE_MIN, NOMBRE_MAX, FACTOR_MONTO_ATIPICO } from '../config/constantes'
import { buscarDuplicado, codigosDeEmpresa, conflictoDeCodigo, crearRecibo, editarRecibo, motivoRechazo, obtenerRecibo, promedioDeEmpresa } from '../data/store'
import { useDatos } from '../data/useDatos'
import { formatoFecha, hoyISO, sumarMeses, FECHA_MINIMA, fechaMaxima, fechaEnRango, textoRangoFechas } from '../utils/fechas'
import { formatoSoles, leerMonto } from '../utils/dinero'
import { soloLetras, soloLetrasNumeros, soloMontoCuota, soloCodigo, soloDigitos, soloAlfanumerico, codigoValido, limpiarNombre, errorDeRuc } from '../utils/validacion'

// Cada tipo de recibo tiene su propio formato de código.
function limpiarCodigoDe(tipo, texto) {
  if (tipo === 'Servicio') return soloDigitos(texto).slice(0, 13)
  if (tipo === 'Impuesto') return soloDigitos(texto).slice(0, 4)
  if (tipo === 'Proveedor') return soloAlfanumerico(texto).slice(0, 10)
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
  const fechaMax = fechaMaxima() // hoy + 24 años
  const [original] = useState(() => (id ? obtenerRecibo(id) : null))
  const { recibos } = useDatos()
  const enVivo = id ? recibos.find((r) => r.id === id) : null // el recibo tal como está AHORA (otro dispositivo pudo cambiarlo)
  // Los préstamos se registran en su propia sección (menú Préstamos), no como recibo suelto.
  // Al editar, el tipo no se puede cambiar: cada tipo tiene su propio formato de código y sus reglas.
  const tiposDisponibles = editando && original ? [original.tipo] : TIPOS.filter((t) => t !== 'Préstamo')

  // Al crear un recibo se empieza con Servicio para que el código aplique su límite desde el inicio.
  const [tipo, setTipo] = useState(original?.tipo ?? 'Servicio')
  const [empresa, setEmpresa] = useState(original?.empresa ?? '')
  const [codigo, setCodigo] = useState(original?.codigo ?? '')
  const [fecha, setFecha] = useState(() => {
    if (original) return original.fechaLimite
    const deCalendario = consulta.get('fecha')
    return fechaEnRango(deCalendario) ? deCalendario : hoy
  })
  const [monto, setMonto] = useState(original ? original.monto.toFixed(2) : '')
  const [errores, setErrores] = useState({})
  const [duplicado, setDuplicado] = useState(null)
  const [avisos, setAvisos] = useState([]) // advertencias que la persona puede aceptar ("Guardar igual")

  // El campo cambia de nombre y de formato según el tipo de recibo
  const esProveedor = tipo === 'Proveedor'
  const esImpuesto = tipo === 'Impuesto'
  const etiquetaEmpresa = esProveedor ? 'Razón Social / RUC' : esImpuesto ? 'Entidad' : 'Empresa'
  const etiquetaFecha = esImpuesto ? 'Período tributario (fecha límite)' : 'Fecha límite'
  const placeholderEmpresa = esProveedor ? 'Ej.: Distribuidora ABC 20123456789' : esImpuesto ? 'Ej.: SUNAT, Municipalidad' : 'Ej.: SEDALIB'
  const ayudaEmpresa = esProveedor
    ? 'Solo letras, números y espacios. Si escribes el RUC, debe tener 11 dígitos y ser válido.'
    : 'Solo letras y signos de nombre. No se permiten números.'
  const limpiarEmpresa = esProveedor ? soloLetrasNumeros : soloLetras

  const ayudaCodigo = esProveedor
    ? 'Exactamente 10 caracteres: letras y números.'
    : tipo === 'Servicio'
      ? 'Entre 8 y 13 dígitos, solo números.'
      : esImpuesto
        ? 'Exactamente 4 dígitos, solo números.'
        : 'Elige el tipo de recibo para validar el formato.'
  const placeholderCodigo = esProveedor ? 'Ej.: F001000231' : esImpuesto ? 'Ej.: 0621' : 'Ej.: 20250412'

  // Empresas ya registradas de este tipo (se sugieren al escribir) y su código, que en Servicio es siempre el mismo
  const empresasConocidas = [...new Set(recibos.filter((r) => !r.prestamoId && r.tipo === tipo).map((r) => r.empresa))].sort()
  function autocompletarCodigo(nombre) {
    if (tipo !== 'Servicio' || codigo.trim()) return
    const c = codigosDeEmpresa(nombre, editando ? id : null)[0]
    if (c) setCodigo(c)
  }

  // Las cuotas de préstamo y los recibos pagados no se editan; tampoco uno que otro dispositivo ya pagó o eliminó
  const bloqueo = !editando
    ? null
    : !original
      ? ['No encontramos este recibo', 'Es posible que ya haya sido eliminado.']
      : original.prestamoId
        ? ['Las cuotas de un préstamo no se pueden editar', 'Solo se pagan o corrigen desde su detalle.']
        : original.estado === 'Pagado'
          ? ['Un recibo pagado no se puede editar', 'Corrige el pago desde su detalle.']
          : !enVivo
            ? ['Este recibo ya no existe', 'Se eliminó desde otro dispositivo mientras lo editabas.']
            : enVivo.estado === 'Pagado'
              ? ['Este recibo se acaba de pagar', 'Otro dispositivo lo pagó mientras lo editabas, así que ya no se puede editar. Corrige el pago desde su detalle.']
              : null
  if (bloqueo) {
    return (
      <Tarjeta className="mx-auto max-w-lg p-6 text-center">
        <p className="text-lg font-bold">{bloqueo[0]}</p>
        <p className="mt-1 text-suave">{bloqueo[1]}</p>
        <Link to={enVivo ? `/recibos/${id}` : '/'} replace state={{ origen }} className="mt-4 inline-flex min-h-12 items-center rounded-full bg-brand px-5 font-semibold text-white">
          Volver
        </Link>
      </Tarjeta>
    )
  }

  function validar() {
    const e = {}
    if (!tipo) e.tipo = 'Elige el tipo de recibo.'
    const nombreEmpresa = limpiarNombre(empresa)
    if (!nombreEmpresa) e.empresa = esProveedor ? 'Escribe la razón social o el RUC.' : esImpuesto ? 'Escribe el nombre de la entidad.' : 'Escribe el nombre de la empresa.'
    else if (!/[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]/.test(nombreEmpresa)) e.empresa = 'Escribe un nombre válido.'
    else if (nombreEmpresa.length < NOMBRE_MIN) e.empresa = `El nombre debe tener al menos ${NOMBRE_MIN} caracteres.`
    else if (esProveedor && errorDeRuc(nombreEmpresa)) e.empresa = errorDeRuc(nombreEmpresa)
    if (!codigo.trim()) e.codigo = 'Escribe el código del recibo.'
    else if (!codigoValido(tipo, codigo)) {
      if (tipo === 'Servicio') e.codigo = 'El código de Servicio debe tener entre 8 y 13 dígitos.'
      else if (esImpuesto) e.codigo = 'El código de Impuesto debe tener exactamente 4 dígitos.'
      else if (esProveedor) e.codigo = 'El código de Proveedor debe tener exactamente 10 letras o números.'
      else e.codigo = 'Escribe un código válido.'
    } else {
      const conflicto = conflictoDeCodigo({ tipo, empresa, codigo }, editando ? id : null)
      if (conflicto) e.codigo = conflicto
    }
    if (!fecha) e.fecha = 'Elige la fecha límite de pago.'
    else if (!fechaEnRango(fecha)) e.fecha = `La fecha límite debe estar ${textoRangoFechas()}.`
    const m = leerMonto(monto)
    if (monto.trim() === '') e.monto = 'Escribe el monto total.'
    else if (!(m > 0)) e.monto = 'Escribe un monto válido, mayor a cero.'
    else if (m > LIMITE_MONTO) e.monto = 'El monto no puede superar S/ 9,999,999,999.99 (10 dígitos enteros).'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  // Advertencias que no impiden guardar, pero conviene confirmar (un año o un cero de más se escapan fácil)
  function advertencias() {
    const lista = []
    const m = leerMonto(monto)
    if (fecha < hoy && !(editando && fecha === original.fechaLimite)) lista.push(`La fecha límite (${formatoFecha(fecha)}) ya pasó: el recibo quedará como Vencido.`)
    if (fecha > sumarMeses(hoy, 12) && !(editando && fecha === original.fechaLimite)) lista.push(`La fecha límite (${formatoFecha(fecha)}) está a más de un año de hoy. Revisa que el año sea el correcto.`)
    const habitual = promedioDeEmpresa(empresa, editando ? id : null)
    if (habitual && !(editando && m === original.monto) && (m > habitual.promedio * FACTOR_MONTO_ATIPICO || m < habitual.promedio / FACTOR_MONTO_ATIPICO)) {
      lista.push(`El monto (${formatoSoles(m)}) es muy distinto a lo habitual de ${limpiarNombre(empresa)} (promedio de ${formatoSoles(habitual.promedio)} ${habitual.cantidad === 1 ? 'en su único recibo anterior' : `en sus últimos ${habitual.cantidad} recibos`}).`)
    }
    return lista
  }

  // Muestra el motivo REAL por el que el store no guardó (junto al campo que corresponde)
  function mostrarRechazo() {
    const r = motivoRechazo()
    setErrores({ [r.campo]: r.mensaje })
  }

  function guardar(confirmado = false) {
    if (!validar()) return
    const datos = {
      tipo,
      empresa,
      codigo,
      fechaLimite: fecha,
      monto: leerMonto(monto),
    }
    // Un mismo recibo (misma empresa y código) no se registra dos veces.
    const previo = buscarDuplicado({ tipo, empresa, codigo, fechaLimite: fecha }, editando ? id : null)
    if (previo) return setDuplicado(previo)
    if (!confirmado) {
      const lista = advertencias()
      if (lista.length) return setAvisos(lista)
    }
    if (editando) {
      const editado = editarRecibo(id, datos)
      if (!editado) return mostrarRechazo()
      navegar(`/recibos/${id}`, { replace: true, state: { origen, aviso: 'Cambios guardados' } })
      return
    }
    const nuevo = crearRecibo(datos)
    if (!nuevo) return mostrarRechazo()
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
              <Chip key={t} activo={tipo === t} onClick={() => !editando && setTipo(t)}>
                {t}
              </Chip>
            ))}
          </div>
          {editando && <p className="mt-1 text-sm text-suave">El tipo de un recibo no se puede cambiar.</p>}
          {errores.tipo && (
            <p role="alert" className="mt-1 text-sm font-semibold text-venc-tx">
              {errores.tipo}
            </p>
          )}
        </fieldset>

        <Campo etiqueta={etiquetaEmpresa} id="f-empresa" error={errores.empresa} ayuda={ayudaEmpresa}>
          <input
            id="f-empresa"
            list="empresas-conocidas"
            maxLength={NOMBRE_MAX}
            value={empresa}
            onChange={(e) => {
              const v = limpiarEmpresa(e.target.value)
              setEmpresa(v)
              if (empresasConocidas.includes(v)) autocompletarCodigo(v) // eligió una empresa de la lista
            }}
            onBlur={() => {
              setEmpresa(limpiarNombre(empresa)) // un solo espacio entre palabras
              autocompletarCodigo(empresa)
            }}
            placeholder={placeholderEmpresa}
            className={claseInput(errores.empresa)}
          />
          <datalist id="empresas-conocidas">
            {empresasConocidas.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Campo>
        <Campo etiqueta="Código del recibo" id="f-codigo" error={errores.codigo} ayuda={ayudaCodigo}>
          <input
            id="f-codigo"
            inputMode={tipo === 'Servicio' || esImpuesto ? 'numeric' : 'text'}
            maxLength={esImpuesto ? 4 : tipo === 'Servicio' ? 13 : esProveedor ? 10 : undefined}
            value={codigo}
            onChange={(e) => setCodigo(limpiarCodigoDe(tipo, e.target.value))}
            placeholder={placeholderCodigo}
            className={claseInput(errores.codigo)}
          />
        </Campo>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta={etiquetaFecha} id="f-fecha" error={errores.fecha}>
            <input id="f-fecha" type="date" min={fechaMinima} max={fechaMax} value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput(errores.fecha)} />
          </Campo>
          <Campo etiqueta="Monto total" id="f-monto" error={errores.monto}>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-suave">S/</span>
              <input id="f-monto" inputMode="decimal" value={monto} onChange={(e) => setMonto(soloMontoCuota(e.target.value))} placeholder="0.00" className={`${claseInput(errores.monto)} pl-11`} />
            </div>
          </Campo>
        </div>

        {errores.general && (
          <p role="alert" className="rounded-xl border border-venc-bd bg-venc-bg px-4 py-3 font-semibold text-venc-tx">
            {errores.general}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Boton onClick={() => navegar(editando ? `/recibos/${id}` : '/', { replace: true, state: { origen } })}>Cancelar</Boton>
          <Boton variante="primario" type="submit" className="sm:min-w-56">
            {editando ? 'Guardar cambios' : 'Guardar recibo'}
          </Boton>
        </div>
      </form>

      {/* HU-05: aviso de recibo repetido */}
      <Ventana abierta={!!duplicado} onCerrar={() => setDuplicado(null)} titulo="Este recibo ya está registrado">
        {duplicado && (
          <>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pend-bg text-pend-tx">
                <AlertTriangle size={26} aria-hidden="true" />
              </span>
              <h2 className="text-xl font-bold">Este recibo ya está registrado</h2>
            </div>
            <p className="mt-3 text-suave">Ya existe un recibo con la misma empresa y el mismo código{duplicado.tipo === 'Servicio' || duplicado.tipo === 'Impuesto' ? ' en ese mes' : ''}:</p>
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

      {/* Advertencias: fecha pasada o muy lejana, o monto muy distinto a lo habitual */}
      <Ventana abierta={avisos.length > 0} onCerrar={() => setAvisos([])} titulo="Revisa estos datos">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pend-bg text-pend-tx">
            <AlertTriangle size={26} aria-hidden="true" />
          </span>
          <h2 className="text-xl font-bold">Revisa estos datos</h2>
        </div>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-suave">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Boton
            onClick={() => {
              setAvisos([])
              guardar(true)
            }}
          >
            Guardar igual
          </Boton>
          <Boton variante="primario" onClick={() => setAvisos([])}>
            Revisar
          </Boton>
        </div>
      </Ventana>
    </div>
  )
}
