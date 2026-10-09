import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowRight, ArrowUUpLeft, DownloadSimple, PaperclipHorizontal, PencilSimple, UserSwitch } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useSesion } from '../../lib/sesion'
import { useCatalogos, useDatos } from '../../lib/useDatos'
import { claseSev, fmtFechaHora } from '../../lib/formato'
import Aviso from '../../components/Aviso'

// RF-040 detalle + historial; RF-031/050 estados; RF-030 asignación; RF-032 acciones;
// RF-033 comentarios; RF-012 evidencias. Toda escritura envía `version` cuando la API la exige.
export default function DetalleIncidente() {
  const { id } = useParams()
  const ubicacion = useLocation()
  const { datos, error, cargando, recargar } = useDatos(() => api.incidente(id).then((r) => r.data), [id])
  const [inc, setInc] = useState(null)
  const actual = inc?.id === Number(id) ? inc : datos

  if (error) {
    return (
      <div className="pagina">
        <Aviso error={error}>{error.status === 404 ? 'Este incidente no existe o no tiene acceso a él.' : error.message}</Aviso>
        <Link to="/panel/incidentes">Volver a incidentes</Link>
      </div>
    )
  }
  if (cargando && !actual) return <div className="pagina"><div className="esqueleto" style={{ height: '30rem' }} aria-label="Cargando incidente" /></div>

  return (
    <Contenido
      inc={actual}
      creado={ubicacion.state?.creado}
      actualizar={setInc}
      recargar={() => { setInc(null); recargar() }}
    />
  )
}

function Contenido({ inc, creado, actualizar, recargar }) {
  const { puede } = useSesion()
  const [error, setError] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const cerrado = inc.estado.nombre === 'cerrado'

  // Ejecuta una operación; si la API responde, la ficha se reemplaza por la versión nueva.
  async function ejecutar(fn) {
    setOcupado(true)
    setError(null)
    try {
      const r = await fn()
      actualizar(r.data)
      return true
    } catch (e) {
      setError(e)
      return false
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="pagina pagina--ancha detalle">
      <div className="detalle__cabeza">
        <p className="migas"><Link to="/panel/incidentes">Incidentes</Link> / <span className="dato">{inc.codigo}</span></p>
        <h1>{inc.titulo}</h1>
        <div className="detalle__chips">
          <span className={`chip chip--${claseSev(inc.severidad.nombre)}`}>Severidad {inc.severidad.nombre}</span>
          <span className="chip chip--estado">Prioridad {inc.prioridad.nombre}</span>
          <span className="chip chip--estado detalle__estado">{inc.estado.nombre}</span>
        </div>
      </div>

      {creado && inc.historial.length === 1 && <p className="aviso" role="status">Incidente registrado. Ya figura en el tablero y en la bitácora.</p>}
      {error && (
        <Aviso>
          {error.message}
          {error.codigo === 'VERSION_DESACTUALIZADA' && (
            <> <button type="button" className="boton boton--secundario boton--chico" onClick={recargar}>Recargar</button></>
          )}
        </Aviso>
      )}

      <Transiciones inc={inc} ejecutar={ejecutar} ocupado={ocupado} />

      <div className="detalle__columnas">
        <div className="detalle__principal">
          <section className="bloque" aria-labelledby="d-desc">
            <div className="bloque__cabeza">
              <h2 id="d-desc">Descripción</h2>
              {puede('incidente:editar') && !cerrado && <Editar inc={inc} ejecutar={ejecutar} ocupado={ocupado} />}
            </div>
            <p className="detalle__descripcion">{inc.descripcion}</p>
            <dl className="datos">
              <div><dt>Categoría</dt><dd>{inc.categoria.nombre}</dd></div>
              <div><dt>Tipo</dt><dd>{inc.tipo.nombre}</dd></div>
              <div><dt>Sistema afectado</dt><dd>{inc.sistema_afectado || '—'}</dd></div>
              <div><dt>Reportado por</dt><dd>{inc.reportante.nombre_completo}</dd></div>
              <div><dt>Registro</dt><dd className="dato">{fmtFechaHora(inc.fecha_registro)}</dd></div>
              <div><dt>Resolución</dt><dd className="dato">{fmtFechaHora(inc.fecha_resolucion)}</dd></div>
              <div><dt>Cierre</dt><dd className="dato">{fmtFechaHora(inc.fecha_cierre)}</dd></div>
            </dl>
          </section>

          <Acciones inc={inc} ejecutar={ejecutar} ocupado={ocupado} />
          <Comentarios inc={inc} ejecutar={ejecutar} ocupado={ocupado} />
          <Evidencias inc={inc} ejecutar={ejecutar} ocupado={ocupado} />
        </div>

        <aside className="detalle__lateral">
          <Responsable inc={inc} ejecutar={ejecutar} ocupado={ocupado} />
          <section className="bloque" aria-labelledby="d-hist">
            <h2 id="d-hist">Historial</h2>
            <p className="bloque__nota">Solo se agregan líneas; nadie puede editarlas ni borrarlas.</p>
            <ol className="historial historial--panel">
              {inc.historial.map((h) => (
                <li key={h.id} className={h.estado_anterior === h.estado_nuevo ? 'historial__nota' : ''}>
                  <span className="dato">{fmtFechaHora(h.fecha)}</span>
                  <b>{h.estado_anterior === h.estado_nuevo ? 'cambio' : h.estado_nuevo}</b>
                  <span>{h.observacion || (h.estado_anterior ? `${h.estado_anterior} → ${h.estado_nuevo}` : 'alta')} · {h.usuario.nombre_completo}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Transiciones({ inc, ejecutar, ocupado }) {
  const { puede } = useSesion()
  const [elegido, setElegido] = useState(null)
  const [observacion, setObservacion] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const desde = inc.estado.nombre

  const opciones = inc.transiciones_permitidas.filter((hacia) =>
    hacia === 'cerrado' || desde === 'cerrado' ? puede('incidente:cerrar') : puede('incidente:atender'))
  const reapertura = desde === 'cerrado'
  const sinAcciones = elegido === 'cerrado' && inc.acciones.length === 0

  if (!opciones.length) {
    return (
      <div className="paso paso--quieto">
        <span>Estado actual: <strong>{desde}</strong>.</span>
        <span className="paso__nota">{inc.transiciones_permitidas.length ? 'Su rol no puede mover este incidente al siguiente estado.' : 'No hay más estados.'}</span>
      </div>
    )
  }

  async function confirmar(e) {
    e.preventDefault()
    const ok = await ejecutar(() => api.cambiarEstado(inc.id, {
      version: inc.version, estado: elegido, observacion: observacion || null, justificacion: justificacion || null,
    }))
    if (ok) { setElegido(null); setObservacion(''); setJustificacion('') }
  }

  return (
    <section className="paso" aria-labelledby="paso-titulo">
      <div className="paso__fila">
        <h2 id="paso-titulo" className="paso__titulo">Siguiente paso</h2>
        <div className="paso__opciones">
          {opciones.map((hacia) => (
            <button
              key={hacia}
              type="button"
              className={`boton ${elegido === hacia ? 'boton--tinta' : 'boton--primario'}`}
              aria-expanded={elegido === hacia}
              onClick={() => setElegido(elegido === hacia ? null : hacia)}
            >
              {reapertura ? <ArrowUUpLeft size={18} weight="bold" aria-hidden="true" /> : <ArrowRight size={18} weight="bold" aria-hidden="true" />}
              {reapertura ? 'Reabrir' : hacia === 'cerrado' ? 'Cerrar incidente' : `Pasar a ${hacia}`}
            </button>
          ))}
        </div>
      </div>
      {elegido && (
        <form className="paso__form" onSubmit={confirmar}>
          {sinAcciones && (
            <p className="aviso aviso--error" role="alert">Para cerrar hace falta al menos una acción registrada (RN-06). Regístrela en "Acciones".</p>
          )}
          {reapertura ? (
            <div className="campo">
              <label className="campo__etiqueta" htmlFor="justificacion">Justificación de la reapertura</label>
              <textarea id="justificacion" className="control" required maxLength={2000} value={justificacion} onChange={(e) => setJustificacion(e.target.value)} />
              <span className="campo__ayuda">Se guarda como una acción del incidente (RN-10).</span>
            </div>
          ) : (
            <div className="campo">
              <label className="campo__etiqueta" htmlFor="observacion">Observación para el historial</label>
              <input id="observacion" className="control" maxLength={1000} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
              <span className="campo__ayuda">Opcional.</span>
            </div>
          )}
          <div className="formulario__acciones">
            <button className="boton boton--primario" disabled={ocupado || sinAcciones || (reapertura && !justificacion.trim())}>
              {ocupado ? 'Guardando…' : `Confirmar: ${desde} → ${elegido}`}
            </button>
            <button type="button" className="boton boton--fantasma" onClick={() => setElegido(null)}>Cancelar</button>
          </div>
        </form>
      )}
    </section>
  )
}

function Editar({ inc, ejecutar, ocupado }) {
  const cat = useCatalogos()
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState(null)

  function abrir() {
    setF({
      titulo: inc.titulo, descripcion: inc.descripcion, sistema_afectado: inc.sistema_afectado || '',
      categoria_id: String(inc.categoria.id), tipo_id: String(inc.tipo.id),
      severidad_id: String(inc.severidad.id), prioridad_id: String(inc.prioridad.id),
    })
    setAbierto(true)
  }

  async function guardar(e) {
    e.preventDefault()
    const ok = await ejecutar(() => api.editarIncidente(inc.id, {
      version: inc.version,
      titulo: f.titulo, descripcion: f.descripcion, sistema_afectado: f.sistema_afectado,
      categoria_id: Number(f.categoria_id), tipo_id: Number(f.tipo_id),
      severidad_id: Number(f.severidad_id), prioridad_id: Number(f.prioridad_id),
    }))
    if (ok) setAbierto(false)
  }

  if (!abierto) {
    return <button type="button" className="boton boton--fantasma boton--chico" onClick={abrir}><PencilSimple size={16} aria-hidden="true" /> Editar datos</button>
  }
  const c = cat.datos
  const sel = (k, etiqueta, lista) => (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={`e-${k}`}>{etiqueta}</label>
      <select id={`e-${k}`} className="control" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value, ...(k === 'categoria_id' ? { tipo_id: '' } : {}) })}>
        <option value="">—</option>
        {lista?.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
    </div>
  )
  return (
    <form className="editar" onSubmit={guardar}>
      <div className="campo">
        <label className="campo__etiqueta" htmlFor="e-titulo">Título</label>
        <input id="e-titulo" className="control" value={f.titulo} maxLength={200} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
      </div>
      <div className="campo">
        <label className="campo__etiqueta" htmlFor="e-desc">Descripción</label>
        <textarea id="e-desc" className="control" value={f.descripcion} maxLength={5000} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
      </div>
      <div className="formulario__grupo--dos">
        {sel('categoria_id', 'Categoría', c?.categorias)}
        {sel('tipo_id', 'Tipo', c?.tipos.filter((t) => String(t.categoria_id) === f.categoria_id))}
        {sel('severidad_id', 'Severidad', c?.severidades)}
        {sel('prioridad_id', 'Prioridad', c?.prioridades)}
      </div>
      <div className="campo">
        <label className="campo__etiqueta" htmlFor="e-sis">Sistema afectado</label>
        <input id="e-sis" className="control" value={f.sistema_afectado} maxLength={150} onChange={(e) => setF({ ...f, sistema_afectado: e.target.value })} />
      </div>
      <p className="campo__ayuda">Los cambios de clasificación quedan en el historial con el valor anterior y el nuevo.</p>
      <div className="formulario__acciones">
        <button className="boton boton--primario boton--chico" disabled={ocupado}>Guardar cambios</button>
        <button type="button" className="boton boton--fantasma boton--chico" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </form>
  )
}

function Responsable({ inc, ejecutar, ocupado }) {
  const { puede } = useSesion()
  const [abierto, setAbierto] = useState(false)
  const [nuevo, setNuevo] = useState('')
  const [obs, setObs] = useState('')
  const candidatos = useDatos(
    () => (puede('incidente:asignar') ? api.usuarios({ activo: 'true' }).then((r) => r.data.filter((u) => u.roles.some((x) => x !== 'consultor'))) : Promise.resolve([])),
  )
  const puedeAsignar = puede('incidente:asignar') && inc.estado.nombre !== 'cerrado'

  async function asignar(e) {
    e.preventDefault()
    const ok = await ejecutar(() => api.asignar(inc.id, { version: inc.version, responsable_id: Number(nuevo), observacion: obs || null }))
    if (ok) { setAbierto(false); setNuevo(''); setObs('') }
  }

  return (
    <section className="bloque" aria-labelledby="d-resp">
      <div className="bloque__cabeza">
        <h2 id="d-resp">Responsable</h2>
        {puedeAsignar && !abierto && (
          <button type="button" className="boton boton--fantasma boton--chico" onClick={() => setAbierto(true)}>
            <UserSwitch size={16} aria-hidden="true" /> Reasignar
          </button>
        )}
      </div>
      <p className="responsable">{inc.responsable?.nombre_completo || 'Sin responsable'}
        {inc.responsable && <span className="dato"> desde {fmtFechaHora(inc.responsable.desde)}</span>}
      </p>
      {abierto && (
        <form className="editar" onSubmit={asignar}>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="r-nuevo">Nuevo responsable</label>
            <select id="r-nuevo" className="control" required value={nuevo} onChange={(e) => setNuevo(e.target.value)}>
              <option value="">Elija un usuario</option>
              {candidatos.datos?.filter((u) => u.id !== inc.responsable?.id).map((u) => (
                <option key={u.id} value={u.id}>{u.nombre_completo} ({u.roles.join(', ')})</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="r-obs">Motivo</label>
            <input id="r-obs" className="control" maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <div className="formulario__acciones">
            <button className="boton boton--primario boton--chico" disabled={ocupado || !nuevo}>Reasignar</button>
            <button type="button" className="boton boton--fantasma boton--chico" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </form>
      )}
      {inc.responsables.length > 1 && (
        <details className="responsables">
          <summary>Asignaciones anteriores ({inc.responsables.length - 1})</summary>
          <ul>
            {inc.responsables.filter((r) => r.fecha_desasignacion).map((r) => (
              <li key={r.fecha_asignacion}>{r.usuario.nombre_completo} <span className="dato">{fmtFechaHora(r.fecha_asignacion)} → {fmtFechaHora(r.fecha_desasignacion)}</span></li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function Acciones({ inc, ejecutar, ocupado }) {
  const { puede } = useSesion()
  const [f, setF] = useState({ descripcion: '', resultado: '' })
  async function agregar(e) {
    e.preventDefault()
    if (await ejecutar(() => api.accion(inc.id, f))) setF({ descripcion: '', resultado: '' })
  }
  return (
    <section className="bloque" aria-labelledby="d-acc">
      <h2 id="d-acc">Acciones <span className="bloque__cuenta dato">{inc.acciones.length}</span></h2>
      {inc.acciones.length ? (
        <ol className="entradas">
          {inc.acciones.map((a) => (
            <li key={a.id}>
              <p>{a.descripcion}</p>
              {a.resultado && <p className="entradas__resultado">Resultado: {a.resultado}</p>}
              <span className="entradas__pie">{a.usuario.nombre_completo} · <span className="dato">{fmtFechaHora(a.fecha)}</span></span>
            </li>
          ))}
        </ol>
      ) : <p className="bloque__vacio">Aún no hay acciones. El cierre exige al menos una.</p>}
      {puede('incidente:atender') && (
        <form className="editar" onSubmit={agregar}>
          {inc.estado.nombre === 'cerrado' && (
            <p className="campo__ayuda">
              Incidente cerrado: lo que registre quedará como acción posterior al cierre (RN-10).
              Para retomar la atención, use «Reabrir».
            </p>
          )}
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="a-desc">{inc.estado.nombre === 'cerrado' ? 'Acción posterior al cierre' : 'Nueva acción'}</label>
            <textarea id="a-desc" className="control" rows={2} required maxLength={2000} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Qué se hizo" />
          </div>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="a-res">Resultado</label>
            <input id="a-res" className="control" maxLength={2000} value={f.resultado} onChange={(e) => setF({ ...f, resultado: e.target.value })} placeholder="Opcional" />
          </div>
          <div className="formulario__acciones">
            <button className="boton boton--secundario boton--chico" disabled={ocupado || !f.descripcion.trim()}>Registrar acción</button>
          </div>
        </form>
      )}
    </section>
  )
}

function Comentarios({ inc, ejecutar, ocupado }) {
  const { puede } = useSesion()
  const [texto, setTexto] = useState('')
  const cerrado = inc.estado.nombre === 'cerrado'
  async function agregar(e) {
    e.preventDefault()
    if (await ejecutar(() => api.comentario(inc.id, { texto }))) setTexto('')
  }
  return (
    <section className="bloque" aria-labelledby="d-com">
      <h2 id="d-com">Comentarios <span className="bloque__cuenta dato">{inc.comentarios.length}</span></h2>
      {inc.comentarios.length ? (
        <ol className="entradas">
          {inc.comentarios.map((c) => (
            <li key={c.id}>
              <p>{c.texto}</p>
              <span className="entradas__pie">{c.usuario.nombre_completo} · <span className="dato">{fmtFechaHora(c.fecha)}</span></span>
            </li>
          ))}
        </ol>
      ) : <p className="bloque__vacio">Sin comentarios.</p>}
      {puede('incidente:atender') && !cerrado && (
        <form className="editar editar--linea" onSubmit={agregar}>
          <label className="visualmente-oculto" htmlFor="c-texto">Nuevo comentario</label>
          <input id="c-texto" className="control" maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escriba un comentario" />
          <button className="boton boton--secundario boton--chico" disabled={ocupado || !texto.trim()}>Comentar</button>
        </form>
      )}
    </section>
  )
}

function Evidencias({ inc, ejecutar, ocupado }) {
  const { puede } = useSesion()
  const [archivo, setArchivo] = useState(null)
  const cerrado = inc.estado.nombre === 'cerrado'
  async function subir(e) {
    e.preventDefault()
    if (await ejecutar(() => api.evidencia(inc.id, archivo))) {
      setArchivo(null)
      e.target.reset()
    }
  }
  return (
    <section className="bloque" aria-labelledby="d-ev">
      <h2 id="d-ev">Evidencias <span className="bloque__cuenta dato">{inc.evidencias.length}</span></h2>
      {inc.evidencias.length ? (
        <ul className="evidencias">
          {inc.evidencias.map((ev) => (
            <li key={ev.id}>
              <a href={api.urlEvidencia(inc.id, ev.id)} download className="evidencias__enlace">
                <DownloadSimple size={18} aria-hidden="true" /> {ev.nombre_archivo}
              </a>
              <code className="evidencias__hash" title={ev.hash_integridad}>sha256 {ev.hash_integridad.slice(0, 12)}…{ev.hash_integridad.slice(-6)}</code>
              <span className="entradas__pie">{ev.usuario.nombre_completo} · <span className="dato">{fmtFechaHora(ev.fecha_carga)}</span></span>
            </li>
          ))}
        </ul>
      ) : <p className="bloque__vacio">Sin evidencias adjuntas.</p>}
      {puede('incidente:atender') && !cerrado && (
        <form className="editar editar--linea" onSubmit={subir}>
          <label className="campo__etiqueta" htmlFor="ev-archivo"><PaperclipHorizontal size={16} aria-hidden="true" /> Adjuntar</label>
          <input id="ev-archivo" type="file" className="control" accept=".pdf,.png,.jpg,.jpeg,.txt,.log,.csv,.json,.pcap,.zip" onChange={(e) => setArchivo(e.target.files[0] || null)} aria-describedby="ev-ayuda" />
          <button className="boton boton--secundario boton--chico" disabled={ocupado || !archivo}>Subir</button>
          <span id="ev-ayuda" className="campo__ayuda">Hasta 10 MB: pdf, imágenes, txt, log, csv, json, pcap, zip. El servidor calcula la huella SHA-256.</span>
        </form>
      )}
    </section>
  )
}
