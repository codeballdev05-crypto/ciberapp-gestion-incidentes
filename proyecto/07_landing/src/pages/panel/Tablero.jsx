import { Link } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useSesion } from '../../lib/sesion'
import { useDatos } from '../../lib/useDatos'
import { ESTADOS } from '../../lib/formato'
import Aviso from '../../components/Aviso'
import Ficha from '../../components/Ficha'

// El mismo tablero de la landing, ahora con datos reales de la API (RF-041, RN-08:
// el analista solo recibe sus incidentes).
export default function Tablero() {
  const { puede } = useSesion()
  const { datos, error, cargando } = useDatos(() => api.incidentes({ por_pagina: 100 }))

  return (
    <div className="pagina pagina--ancha">
      <div className="pagina__cabeza">
        <div>
          <h1>Tablero</h1>
          <p className="pagina__bajada">Cada columna es un estado. Abra una ficha para atenderla.</p>
        </div>
        {puede('incidente:crear') && (
          <Link to="/panel/incidentes/nuevo" className="boton boton--primario">
            <Plus size={18} weight="bold" aria-hidden="true" /> Registrar incidente
          </Link>
        )}
      </div>
      <Aviso error={error} />
      <div className="tablero">
        {ESTADOS.map((estado) => {
          const fichas = datos?.data.filter((i) => i.estado.nombre === estado) || []
          return (
            <section key={estado} className="tablero__bahia" aria-labelledby={`b-${estado}`}>
              <h2 id={`b-${estado}`} className="bahia__rotulo">
                {estado}<span className="bahia__cuenta">{cargando ? '·' : fichas.length}</span>
              </h2>
              <div className="bahia__ranura">
                {cargando && [0, 1].map((k) => <div key={k} className="esqueleto" style={{ height: '5.2rem' }} />)}
                {!cargando && !fichas.length && <p className="tablero__vacio">Sin incidentes</p>}
                {fichas.map((i) => <Ficha key={i.id} incidente={i} href={`/panel/incidentes/${i.id}`} />)}
              </div>
            </section>
          )
        })}
      </div>
      {datos?.meta.total > 100 && (
        <p className="pagina__nota">Se muestran los 100 más recientes de {datos.meta.total}. Use <Link to="/panel/incidentes">Incidentes</Link> para buscar.</p>
      )}
    </div>
  )
}
