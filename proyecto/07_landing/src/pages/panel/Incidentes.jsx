import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useSesion } from '../../lib/sesion'
import { useCatalogos, useDatos } from '../../lib/useDatos'
import { claseSev, fmtFechaHora } from '../../lib/formato'
import Aviso from '../../components/Aviso'

// RF-041: búsqueda y filtros. Los filtros viven en la URL (se pueden compartir y recargar).
export default function Incidentes() {
  const { puede } = useSesion()
  const [params, setParams] = useSearchParams()
  const filtros = Object.fromEntries(params)
  const [texto, setTexto] = useState(filtros.q || '')
  const cat = useCatalogos()
  const { datos, error, cargando } = useDatos(() => api.incidentes({ por_pagina: 20, ...filtros }), [params.toString()])

  // Búsqueda con espera breve para no consultar en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filtros.q || '') !== texto) cambiar('q', texto)
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto])

  function cambiar(clave, valor) {
    const p = new URLSearchParams(params)
    if (valor) p.set(clave, valor); else p.delete(clave)
    if (clave !== 'pagina') p.delete('pagina')
    setParams(p)
  }

  const selector = (clave, etiqueta, opciones) => (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={`f-${clave}`}>{etiqueta}</label>
      <select id={`f-${clave}`} className="control" value={filtros[clave] || ''} onChange={(e) => cambiar(clave, e.target.value)}>
        <option value="">Todos</option>
        {opciones?.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
    </div>
  )

  const pagina = Number(filtros.pagina || 1)
  const hayFiltros = params.toString().length > 0

  return (
    <div className="pagina pagina--ancha">
      <div className="pagina__cabeza">
        <div>
          <h1>Incidentes</h1>
          <p className="pagina__bajada">{datos ? `${datos.meta.total} resultado${datos.meta.total === 1 ? '' : 's'}` : 'Buscando…'}</p>
        </div>
        {puede('incidente:crear') && (
          <Link to="/panel/incidentes/nuevo" className="boton boton--primario">
            <Plus size={18} weight="bold" aria-hidden="true" /> Registrar incidente
          </Link>
        )}
      </div>

      <form className="filtros" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="campo filtros__busqueda">
          <label className="campo__etiqueta" htmlFor="f-q">Buscar</label>
          <div className="control-icono">
            <MagnifyingGlass size={18} aria-hidden="true" />
            <input id="f-q" type="search" className="control" placeholder="Código, título o sistema" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
        </div>
        {selector('estado', 'Estado', cat.datos?.estados)}
        {selector('severidad', 'Severidad', cat.datos?.severidades)}
        {selector('prioridad', 'Prioridad', cat.datos?.prioridades)}
        {selector('categoria', 'Categoría', cat.datos?.categorias)}
        {hayFiltros && (
          <button type="button" className="boton boton--fantasma filtros__limpiar" onClick={() => { setTexto(''); setParams({}) }}>
            Limpiar filtros
          </button>
        )}
      </form>

      <Aviso error={error} />
      {cargando && !datos && <div className="esqueleto" style={{ height: '24rem' }} aria-label="Cargando incidentes" />}
      {datos && !datos.data.length && (
        <div className="vacio">
          <strong>{hayFiltros ? 'Ningún incidente coincide con estos filtros' : 'Todavía no hay incidentes'}</strong>
          <span>{hayFiltros ? 'Pruebe con menos filtros o con otro texto.' : 'Los incidentes registrados aparecerán aquí.'}</span>
        </div>
      )}
      {datos?.data.length > 0 && (
        <>
          <div className="tabla-marco" tabIndex={0} role="region" aria-label="Lista de incidentes (desplazable)" aria-busy={cargando}>
            <table className="tabla tabla--incidentes">
              <caption className="visualmente-oculto">Incidentes, ordenados del más reciente al más antiguo</caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Título</th>
                  <th scope="col">Severidad</th>
                  <th scope="col">Prioridad</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Responsable</th>
                  <th scope="col">Registro</th>
                </tr>
              </thead>
              <tbody>
                {datos.data.map((i) => (
                  <tr key={i.id}>
                    <td className="dato"><Link to={`/panel/incidentes/${i.id}`}>{i.codigo}</Link></td>
                    <td className="tabla__titulo">{i.titulo}<span>{i.categoria.nombre} · {i.tipo.nombre}</span></td>
                    <td><span className={`chip chip--${claseSev(i.severidad.nombre)}`}>{i.severidad.nombre}</span></td>
                    <td>{i.prioridad.nombre}</td>
                    <td><span className="chip chip--estado">{i.estado.nombre}</span></td>
                    <td>{i.responsable?.nombre_completo || '—'}</td>
                    <td className="dato">{fmtFechaHora(i.fecha_registro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {datos.meta.paginas > 1 && (
            <nav className="paginacion" aria-label="Paginación">
              <button type="button" className="boton boton--secundario boton--chico" disabled={pagina <= 1} onClick={() => cambiar('pagina', String(pagina - 1))}>Anterior</button>
              <span className="dato">Página {pagina} de {datos.meta.paginas}</span>
              <button type="button" className="boton boton--secundario boton--chico" disabled={pagina >= datos.meta.paginas} onClick={() => cambiar('pagina', String(pagina + 1))}>Siguiente</button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
