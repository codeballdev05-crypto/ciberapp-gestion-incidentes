// Cliente de la API. Mismo origen (proxy de Vite) → la cookie httpOnly viaja sola;
// el frontend nunca ve ni guarda el token (sin localStorage).
const BASE = '/api/v1'

export class ErrorApi extends Error {
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje)
    this.status = status
    this.codigo = codigo
    this.detalles = detalles || []
  }
  // Errores de validación indexados por campo, para mostrarlos bajo cada control.
  porCampo() {
    return Object.fromEntries(this.detalles.map((d) => [d.campo, d.mensaje]))
  }
}

let alExpirar = () => {}
export const onSesionExpirada = (fn) => { alExpirar = fn }

async function solicitar(metodo, ruta, cuerpo, { formData = false } = {}) {
  let respuesta
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: cuerpo && !formData ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo ? (formData ? cuerpo : JSON.stringify(cuerpo)) : undefined,
    })
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No se pudo conectar con la API. Verifique que el servidor esté en ejecución.')
  }
  if (respuesta.status === 204) return null
  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    const e = datos?.error
    if (respuesta.status === 401 && !ruta.startsWith('/auth/')) alExpirar()
    throw new ErrorApi(respuesta.status, e?.codigo || 'ERROR', e?.mensaje || `Error ${respuesta.status}`, e?.detalles)
  }
  return datos
}

const consulta = (params = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  return q.toString() ? `?${q}` : ''
}

export const api = {
  salud: () => solicitar('GET', '/salud'),
  login: (usuario, contrasena) => solicitar('POST', '/auth/login', { usuario, contrasena }),
  logout: () => solicitar('POST', '/auth/logout'),
  yo: () => solicitar('GET', '/auth/me'),
  catalogos: () => solicitar('GET', '/catalogos'),
  incidentes: (filtros) => solicitar('GET', `/incidentes${consulta(filtros)}`),
  incidente: (id) => solicitar('GET', `/incidentes/${id}`),
  crearIncidente: (datos) => solicitar('POST', '/incidentes', datos),
  editarIncidente: (id, datos) => solicitar('PATCH', `/incidentes/${id}`, datos),
  cambiarEstado: (id, datos) => solicitar('POST', `/incidentes/${id}/estado`, datos),
  asignar: (id, datos) => solicitar('POST', `/incidentes/${id}/asignacion`, datos),
  accion: (id, datos) => solicitar('POST', `/incidentes/${id}/acciones`, datos),
  comentario: (id, datos) => solicitar('POST', `/incidentes/${id}/comentarios`, datos),
  evidencia: (id, archivo) => {
    const fd = new FormData()
    fd.append('archivo', archivo)
    return solicitar('POST', `/incidentes/${id}/evidencias`, fd, { formData: true })
  },
  urlEvidencia: (id, evidenciaId) => `${BASE}/incidentes/${id}/evidencias/${evidenciaId}/archivo`,
  usuarios: (filtros) => solicitar('GET', `/usuarios${consulta(filtros)}`),
  crearUsuario: (datos) => solicitar('POST', '/usuarios', datos),
  editarUsuario: (id, datos) => solicitar('PATCH', `/usuarios/${id}`, datos),
  resumen: () => solicitar('GET', '/reportes/resumen'),
  auditoria: (params) => solicitar('GET', `/auditoria${consulta(params)}`),
}
