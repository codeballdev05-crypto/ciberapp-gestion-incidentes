import { useEffect, useState } from 'react'
import { api } from '../lib/api'

// Conexión pública real con la API: GET /salud (no expone datos de incidentes).
export default function EstadoApi() {
  const [estado, setEstado] = useState({ tipo: 'consultando' })

  useEffect(() => {
    let vivo = true
    const consultar = () =>
      api.salud()
        .then((r) => vivo && setEstado({ tipo: r.data.base_datos === 'ok' ? 'ok' : 'degradado', fecha: r.data.fecha }))
        .catch(() => vivo && setEstado({ tipo: 'caido' }))
    consultar()
    const t = setInterval(consultar, 30000)
    return () => { vivo = false; clearInterval(t) }
  }, [])

  const texto = {
    consultando: 'Consultando la API…',
    ok: 'API y base de datos operativas',
    degradado: 'API activa, base de datos sin conexión',
    caido: 'API sin respuesta',
  }[estado.tipo]

  return (
    <p className={`estado-api estado-api--${estado.tipo}`} role="status">
      <span className="estado-api__punto" aria-hidden="true" />
      {texto}
      {estado.fecha && (
        <span className="estado-api__hora">
          verificado a las {new Date(estado.fecha).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </p>
  )
}
