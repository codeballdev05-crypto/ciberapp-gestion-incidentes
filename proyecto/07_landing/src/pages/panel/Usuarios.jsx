import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { UserPlus } from '@phosphor-icons/react'
import { api } from '../../lib/api'
import { useSesion } from '../../lib/sesion'
import { useDatos } from '../../lib/useDatos'
import { fmtFechaHora } from '../../lib/formato'
import Aviso from '../../components/Aviso'

const ROLES = ['administrador', 'gestor', 'analista', 'consultor']
const VACIO = { usuario: '', nombre_completo: '', correo: '', contrasena: '', roles: ['analista'] }

// RF-001: usuarios y roles. Inactivación lógica (sin borrado).
export default function Usuarios() {
  const { usuario: yo, puede } = useSesion()
  const { datos, error, cargando, recargar } = useDatos(() => api.usuarios().then((r) => r.data))
  const [nuevo, setNuevo] = useState(null)
  const [errores, setErrores] = useState({})
  const [fallo, setFallo] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  if (!puede('usuario:administrar')) return <Navigate to="/panel" replace />

  async function operar(fn) {
    setOcupado(true)
    setFallo(null)
    try { await fn(); recargar(); return true } catch (e) { setFallo(e); setErrores(e.porCampo?.() || {}); return false } finally { setOcupado(false) }
  }

  async function crear(e) {
    e.preventDefault()
    const ok = await operar(() => api.crearUsuario({ ...nuevo, correo: nuevo.correo || null }))
    if (ok) { setNuevo(null); setErrores({}) }
  }

  const alternarRol = (lista, rol) => (lista.includes(rol) ? lista.filter((r) => r !== rol) : [...lista, rol])

  return (
    <div className="pagina pagina--ancha">
      <div className="pagina__cabeza">
        <div>
          <h1>Usuarios</h1>
          <p className="pagina__bajada">Un usuario desactivado pierde el acceso de inmediato. Nunca se borra: su rastro en incidentes se conserva.</p>
        </div>
        {!nuevo && (
          <button type="button" className="boton boton--primario" onClick={() => { setNuevo(VACIO); setErrores({}) }}>
            <UserPlus size={18} weight="bold" aria-hidden="true" /> Nuevo usuario
          </button>
        )}
      </div>
      <Aviso error={error || fallo} />

      {nuevo && (
        <form className="formulario formulario--usuario" onSubmit={crear} noValidate>
          <fieldset className="formulario__grupo formulario__grupo--dos">
            <legend>Nuevo usuario</legend>
            {[
              ['usuario', 'Usuario', 'text', 'Minúsculas, números, punto o guion.'],
              ['nombre_completo', 'Nombre completo', 'text'],
              ['correo', 'Correo', 'email', 'Opcional.'],
              ['contrasena', 'Contraseña inicial', 'password', 'Al menos 10 caracteres, con letras y números.'],
            ].map(([k, etiqueta, tipo, ayuda]) => (
              <div className="campo" key={k}>
                <label className="campo__etiqueta" htmlFor={`u-${k}`}>{etiqueta}</label>
                <input id={`u-${k}`} type={tipo} className="control" autoComplete={tipo === 'password' ? 'new-password' : 'off'}
                  value={nuevo[k]} onChange={(e) => setNuevo({ ...nuevo, [k]: e.target.value })} aria-invalid={errores[k] ? 'true' : undefined} />
                {ayuda && <span className="campo__ayuda">{ayuda}</span>}
                {errores[k] && <span className="campo__error">{errores[k]}</span>}
              </div>
            ))}
            <fieldset className="roles-elegir">
              <legend className="campo__etiqueta">Roles</legend>
              {ROLES.map((r) => (
                <label key={r} className="casilla">
                  <input type="checkbox" checked={nuevo.roles.includes(r)} onChange={() => setNuevo({ ...nuevo, roles: alternarRol(nuevo.roles, r) })} /> {r}
                </label>
              ))}
              {errores.roles && <span className="campo__error">{errores.roles}</span>}
            </fieldset>
          </fieldset>
          <div className="formulario__acciones">
            <button className="boton boton--primario" disabled={ocupado || !nuevo.roles.length}>Crear usuario</button>
            <button type="button" className="boton boton--fantasma" onClick={() => setNuevo(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {cargando && !datos && <div className="esqueleto" style={{ height: '16rem' }} aria-label="Cargando usuarios" />}
      {datos && (
        <div className="tabla-marco" tabIndex={0} role="region" aria-label="Usuarios del sistema (desplazable)">
          <table className="tabla">
            <caption className="visualmente-oculto">Usuarios del sistema</caption>
            <thead>
              <tr><th scope="col">Usuario</th><th scope="col">Nombre</th><th scope="col">Roles</th><th scope="col">Último acceso</th><th scope="col">Estado</th></tr>
            </thead>
            <tbody>
              {datos.map((u) => (
                <tr key={u.id} className={u.activo ? '' : 'tabla__inactivo'}>
                  <td className="dato">{u.usuario}</td>
                  <td>{u.nombre_completo}</td>
                  <td>
                    <div className="roles-elegir roles-elegir--fila">
                      {ROLES.map((r) => (
                        <label key={r} className="casilla">
                          <input
                            type="checkbox"
                            checked={u.roles.includes(r)}
                            disabled={ocupado || (u.id === yo.id && r === 'administrador')}
                            onChange={() => {
                              const roles = alternarRol(u.roles, r)
                              if (roles.length) operar(() => api.editarUsuario(u.id, { roles }))
                            }}
                          /> {r}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="dato">{fmtFechaHora(u.ultimo_acceso)}</td>
                  <td>
                    <button
                      type="button"
                      className="boton boton--secundario boton--chico"
                      disabled={ocupado || u.id === yo.id}
                      onClick={() => operar(() => api.editarUsuario(u.id, { activo: !u.activo }))}
                      aria-label={`${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre_completo}`}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
