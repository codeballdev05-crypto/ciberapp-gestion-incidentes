import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useSesion } from '../../lib/sesion'
import { useDatos } from '../../lib/useDatos'
import Aviso from '../../components/Aviso'
import Ficha from '../../components/Ficha'

// RF-060 (mínimo, aprobado por el humano 08/10/2026): indicadores para roles con reporte:ver.
// El analista ve en su lugar "sus" incidentes (RN-08).
export default function Resumen() {
  const { usuario, puede } = useSesion()
  return (
    <div className="pagina">
      <div className="pagina__cabeza">
        <div>
          <h1>Hola, {usuario.nombre_completo.split(' ')[0]}</h1>
          <p className="pagina__bajada">
            {puede('reporte:ver') ? 'Situación actual de los incidentes de la organización.' : 'Incidentes que tiene asignados.'}
          </p>
        </div>
        {puede('incidente:crear') && (
          <Link to="/panel/incidentes/nuevo" className="boton boton--primario">
            <Plus size={18} weight="bold" aria-hidden="true" /> Registrar incidente
          </Link>
        )}
      </div>
      {puede('reporte:ver') ? <Indicadores /> : <MisIncidentes />}
    </div>
  )
}

function Indicadores() {
  const { datos, error, cargando } = useDatos(() => api.resumen().then((r) => r.data))
  if (error) return <Aviso error={error} />
  if (cargando) return <div className="esqueleto" style={{ height: '22rem' }} aria-label="Cargando indicadores" />

  const horas = datos.horas_promedio_resolucion
  return (
    <div className="resumen">
      <dl className="cifras">
        <div><dt>Incidentes registrados</dt><dd className="cifra">{datos.total}</dd></div>
        <div><dt>Abiertos</dt><dd className="cifra">{datos.abiertos}</dd></div>
        <div className={datos.criticos_abiertos ? 'cifras__alerta' : ''}>
          <dt>Críticos abiertos</dt><dd className="cifra">{datos.criticos_abiertos}</dd>
        </div>
        <div><dt>Tiempo medio de resolución</dt><dd className="cifra">{horas == null ? '—' : `${horas} h`}</dd></div>
      </dl>
      <div className="resumen__grilla">
        <Barras titulo="Por estado" filas={datos.por_estado} />
        <Barras titulo="Por severidad" filas={datos.por_severidad} />
        <Barras titulo="Por categoría" filas={datos.por_categoria} />
      </div>
      <Tendencia dias={datos.registrados_ultimos_30_dias} />
    </div>
  )
}

// Barras horizontales de una sola serie: magnitud. Etiqueta y valor en texto (no solo color).
function Barras({ titulo, filas }) {
  const max = Math.max(1, ...filas.map((f) => f.total))
  return (
    <section className="grafico" aria-labelledby={`g-${titulo}`}>
      <h2 id={`g-${titulo}`} className="grafico__titulo">{titulo}</h2>
      <ul className="barras">
        {filas.map((f) => (
          <li key={f.nombre} className="barras__fila">
            <span className="barras__etiqueta">{f.nombre}</span>
            <span className="barras__pista" aria-hidden="true">
              <span className="barras__barra" style={{ width: `${(f.total / max) * 100}%` }} />
            </span>
            <span className="barras__valor dato">{f.total}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Columnas: cambio en el tiempo (30 días). Tooltip por columna + tabla equivalente.
function Tendencia({ dias }) {
  const [activo, setActivo] = useState(null)
  const max = Math.max(1, ...dias.map((d) => d.total))
  const W = 600
  const H = 140
  const paso = W / dias.length
  const fmt = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es', { day: '2-digit', month: 'short' })

  return (
    <section className="grafico" aria-labelledby="g-tendencia">
      <h2 id="g-tendencia" className="grafico__titulo">Registrados en los últimos 30 días</h2>
      <div className="tendencia">
        <svg viewBox={`0 0 ${W} ${H + 2}`} role="img" aria-label={`Incidentes registrados por día; máximo ${max} en un día`} onMouseLeave={() => setActivo(null)}>
          <line x1="0" x2={W} y1={H} y2={H} className="tendencia__base" />
          {dias.map((d, i) => {
            const alto = Math.max(8, (d.total / max) * (H - 10))
            return (
              <g key={d.fecha} onMouseEnter={() => setActivo(i)}>
                <rect x={i * paso} y="0" width={paso} height={H} fill="transparent" />
                {d.total > 0 && (
                  <path
                    className={`tendencia__columna${activo === i ? ' tendencia__columna--activa' : ''}`}
                    d={`M${i * paso + 1},${H} v${-(alto - 4)} q0,-4 4,-4 h${paso - 10} q4,0 4,4 v${alto - 4} z`}
                  />
                )}
              </g>
            )
          })}
        </svg>
        <p className="tendencia__eje" aria-hidden="true"><span>{fmt(dias[0].fecha)}</span><span>hoy</span></p>
        {activo != null && (
          <p className="tendencia__tooltip" style={{ left: `${((activo + 0.5) / dias.length) * 100}%` }} aria-hidden="true">
            <span>{fmt(dias[activo].fecha)}</span> <strong className="dato">{dias[activo].total}</strong>
          </p>
        )}
      </div>
      <details className="grafico__tabla">
        <summary>Ver como tabla</summary>
        <div className="tabla-marco" tabIndex={0} role="region" aria-label="Registrados por día (desplazable)">
          <table className="tabla">
            <thead><tr><th scope="col">Fecha</th><th scope="col">Registrados</th></tr></thead>
            <tbody>
              {dias.filter((d) => d.total > 0).map((d) => (
                <tr key={d.fecha}><td>{fmt(d.fecha)}</td><td className="dato">{d.total}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

function MisIncidentes() {
  const { datos, error, cargando } = useDatos(() => api.incidentes({ por_pagina: 50 }))
  if (error) return <Aviso error={error} />
  if (cargando) return <div className="esqueleto" style={{ height: '12rem' }} aria-label="Cargando incidentes" />
  const abiertos = datos.data.filter((i) => i.estado.nombre !== 'cerrado')
  if (!abiertos.length) {
    return (
      <div className="vacio">
        <strong>No tiene incidentes abiertos</strong>
        <span>Cuando un gestor le asigne uno, aparecerá aquí.</span>
      </div>
    )
  }
  return (
    <div className="lista-fichas">
      {abiertos.map((i) => <Ficha key={i.id} incidente={i} href={`/panel/incidentes/${i.id}`} mostrarEstado />)}
    </div>
  )
}
