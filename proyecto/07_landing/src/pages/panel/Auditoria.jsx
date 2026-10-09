import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useSesion } from '../../lib/sesion'
import { useDatos } from '../../lib/useDatos'
import { fmtFechaHora } from '../../lib/formato'
import Aviso from '../../components/Aviso'

// RF-070: bitácora append-only, solo lectura.
export default function Auditoria() {
  const { puede } = useSesion()
  const [pagina, setPagina] = useState(1)
  const { datos, error, cargando } = useDatos(() => api.auditoria({ pagina, por_pagina: 50 }), [pagina])
  if (!puede('auditoria:ver')) return <Navigate to="/panel" replace />

  return (
    <div className="pagina pagina--ancha">
      <div className="pagina__cabeza">
        <div>
          <h1>Auditoría</h1>
          <p className="pagina__bajada">Bitácora de operaciones. La base de datos no permite modificar ni borrar estas filas.</p>
        </div>
      </div>
      <Aviso error={error} />
      {cargando && !datos && <div className="esqueleto" style={{ height: '24rem' }} aria-label="Cargando bitácora" />}
      {datos && (
        <>
          <div className="tabla-marco" tabIndex={0} role="region" aria-label="Bitácora de auditoría (desplazable)" aria-busy={cargando}>
            <table className="tabla">
              <caption className="visualmente-oculto">Bitácora de auditoría, más reciente primero</caption>
              <thead>
                <tr><th scope="col">Fecha</th><th scope="col">Operación</th><th scope="col">Entidad</th><th scope="col">Incidente</th><th scope="col">Usuario</th><th scope="col">Origen</th></tr>
              </thead>
              <tbody>
                {datos.data.map((a) => (
                  <tr key={a.id} className={a.operacion === 'LOGIN_FALLIDO' ? 'tabla__alerta' : ''}>
                    <td className="dato">{fmtFechaHora(a.fecha)}</td>
                    <td className="dato">{a.operacion}</td>
                    <td>{a.entidad}{a.registro_id ? <span className="dato"> #{a.registro_id}</span> : ''}</td>
                    <td className="dato">{a.incidente || '—'}</td>
                    <td>{a.usuario || 'sistema'}</td>
                    <td className="dato">{a.origen || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="paginacion" aria-label="Paginación">
            <button type="button" className="boton boton--secundario boton--chico" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <span className="dato">Página {pagina} de {datos.meta.paginas} · {datos.meta.total} registros</span>
            <button type="button" className="boton boton--secundario boton--chico" disabled={pagina >= datos.meta.paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
          </nav>
        </>
      )}
    </div>
  )
}
