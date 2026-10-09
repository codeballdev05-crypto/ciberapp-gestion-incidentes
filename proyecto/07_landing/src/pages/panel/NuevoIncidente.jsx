import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useSesion } from '../../lib/sesion'
import { useCatalogos, useDatos } from '../../lib/useDatos'
import Aviso from '../../components/Aviso'

const VACIO = { titulo: '', descripcion: '', categoria_id: '', tipo_id: '', severidad_id: '', prioridad_id: '', responsable_id: '', sistema_afectado: '' }

// RF-010 / RF-011 / RF-020 / RF-021 / RN-01 / RN-04.
export default function NuevoIncidente() {
  const { puede } = useSesion()
  const navegar = useNavigate()
  const cat = useCatalogos()
  const resp = useDatos(() => api.usuarios({ activo: 'true' }).then((r) => r.data.filter((u) => u.roles.some((x) => x !== 'consultor'))))
  const [f, setF] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  if (!puede('incidente:crear')) return <Navigate to="/panel" replace />

  const c = cat.datos
  const tipos = c?.tipos.filter((t) => String(t.categoria_id) === f.categoria_id) || []
  const critica = c?.severidades.find((s) => s.nombre === 'crítica')
  const alta = c?.prioridades.find((p) => p.nombre === 'alta')
  const esCritica = critica && f.severidad_id === String(critica.id)

  function poner(campo, valor) {
    setF((prev) => {
      const sig = { ...prev, [campo]: valor }
      if (campo === 'categoria_id') sig.tipo_id = ''
      // RN-04 en la interfaz: severidad crítica fija la prioridad en alta (la API lo vuelve a validar).
      if (campo === 'severidad_id' && critica && valor === String(critica.id)) sig.prioridad_id = String(alta.id)
      return sig
    })
    // Si RN-04 fijó la prioridad automáticamente, su error previo también deja de aplicar.
    const fijaPrioridad = campo === 'severidad_id' && critica && valor === String(critica.id)
    setErrores((e) => ({ ...e, [campo]: undefined, ...(fijaPrioridad ? { prioridad_id: undefined } : {}) }))
  }

  async function enviar(e) {
    e.preventDefault()
    const faltan = ['titulo', 'descripcion', 'categoria_id', 'tipo_id', 'severidad_id', 'prioridad_id', 'responsable_id']
      .filter((k) => !String(f[k]).trim())
    if (faltan.length) {
      setErrores(Object.fromEntries(faltan.map((k) => [k, 'Obligatorio'])))
      document.getElementById(`n-${faltan[0]}`)?.focus()
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const datos = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, k.endsWith('_id') ? Number(v) : v]))
      const r = await api.crearIncidente(datos)
      navegar(`/panel/incidentes/${r.data.id}`, { state: { creado: true } })
    } catch (err) {
      setError(err)
      setErrores(err.porCampo?.() || {})
    } finally {
      setEnviando(false)
    }
  }

  const campo = (k, etiqueta, control, ayuda) => (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={`n-${k}`}>{etiqueta}</label>
      {control}
      {ayuda && <span className="campo__ayuda" id={`n-${k}-ayuda`}>{ayuda}</span>}
      {errores[k] && <span className="campo__error" id={`n-${k}-error`}>{errores[k]}</span>}
    </div>
  )
  const props = (k) => ({
    id: `n-${k}`,
    className: 'control',
    value: f[k],
    onChange: (e) => poner(k, e.target.value),
    'aria-invalid': errores[k] ? 'true' : undefined,
    'aria-describedby': [errores[k] && `n-${k}-error`].filter(Boolean).join(' ') || undefined,
  })
  const opciones = (lista, vacio) => [
    <option key="" value="">{vacio}</option>,
    ...(lista || []).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>),
  ]

  return (
    <div className="pagina pagina--estrecha">
      <div className="pagina__cabeza">
        <div>
          <p className="migas"><Link to="/panel/incidentes">Incidentes</Link> / Nuevo</p>
          <h1>Registrar incidente</h1>
          <p className="pagina__bajada">Queda en estado <strong>registrado</strong> con su responsable, y la primera línea del historial se escribe en ese momento.</p>
        </div>
      </div>
      <Aviso error={cat.error || resp.error} />
      <form className="formulario" onSubmit={enviar} noValidate>
        {error && <Aviso>{error.message}{error.codigo === 'VALIDACION' ? ' Revise los campos marcados.' : ''}</Aviso>}
        <fieldset className="formulario__grupo">
          <legend>Qué pasó</legend>
          {campo('titulo', 'Título', <input {...props('titulo')} maxLength={200} />)}
          {campo('descripcion', 'Descripción', <textarea {...props('descripcion')} maxLength={5000} rows={5} />, 'Qué se observó, cuándo y cómo se detectó.')}
          {campo('sistema_afectado', 'Sistema o recurso afectado', <input {...props('sistema_afectado')} maxLength={150} />, 'Opcional. Por ejemplo: FS-CONTA-01, portal web.')}
        </fieldset>
        <fieldset className="formulario__grupo formulario__grupo--dos">
          <legend>Clasificación</legend>
          {campo('categoria_id', 'Categoría', <select {...props('categoria_id')}>{opciones(c?.categorias, 'Elija una categoría')}</select>)}
          {campo('tipo_id', 'Tipo', <select {...props('tipo_id')} disabled={!f.categoria_id}>{opciones(tipos, f.categoria_id ? 'Elija un tipo' : 'Primero la categoría')}</select>)}
          {campo('severidad_id', 'Severidad', <select {...props('severidad_id')}>{opciones(c?.severidades, 'Elija la severidad')}</select>, 'Según el impacto y la criticidad del activo (RN-03).')}
          {campo('prioridad_id', 'Prioridad', <select {...props('prioridad_id')} disabled={esCritica}>{opciones(c?.prioridades, 'Elija la prioridad')}</select>,
            esCritica ? 'Fijada en alta: un incidente crítico se atiende con prioridad (RN-04).' : undefined)}
        </fieldset>
        <fieldset className="formulario__grupo">
          <legend>Responsable</legend>
          {campo('responsable_id', 'Quién lo atiende',
            <select {...props('responsable_id')}>
              {opciones(resp.datos?.map((u) => ({ id: u.id, nombre: `${u.nombre_completo} (${u.roles.join(', ')})` })), 'Elija un responsable')}
            </select>,
            'Obligatorio desde el registro (RN-01).')}
        </fieldset>
        <div className="formulario__acciones">
          <button className="boton boton--primario" disabled={enviando}>{enviando ? 'Registrando…' : 'Registrar incidente'}</button>
          <Link to="/panel/incidentes" className="boton boton--fantasma">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}
