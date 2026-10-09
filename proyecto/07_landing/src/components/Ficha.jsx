import { Link } from 'react-router-dom'
import { claseSev, fmtHora, nombreCorto } from '../lib/formato'

// Ficha de progreso de un incidente. La severidad se comunica con color Y con texto
// (inicial impresa en el canto + campo "Sev"), nunca solo con color.
export default function Ficha({ incidente, href, estilo, mostrarEstado = false }) {
  const sev = incidente.severidad.nombre
  const contenido = (
    <>
      <span className="ficha__canto" aria-hidden="true">{sev}</span>
      <div className="ficha__cuerpo">
        <div className="ficha__fila">
          <span className="ficha__codigo">{incidente.codigo}</span>
          {incidente.fecha_registro && <span className="ficha__hora">{fmtHora(incidente.fecha_registro)}</span>}
        </div>
        <p className="ficha__titulo">{incidente.titulo}</p>
        <dl className="ficha__campos">
          <div><dt>Sev</dt><dd>{sev}</dd></div>
          <div><dt>Pri</dt><dd>{incidente.prioridad.nombre}</dd></div>
          {mostrarEstado && <div><dt>Est</dt><dd>{incidente.estado.nombre}</dd></div>}
          <div><dt>Resp</dt><dd>{incidente.responsable ? nombreCorto(incidente.responsable.nombre_completo) : '—'}</dd></div>
        </dl>
      </div>
    </>
  )
  const clase = `ficha ficha--${claseSev(sev)}`
  return href ? (
    <Link to={href} className={clase} style={estilo}>
      {contenido}
    </Link>
  ) : (
    <article className={clase} style={estilo}>{contenido}</article>
  )
}
