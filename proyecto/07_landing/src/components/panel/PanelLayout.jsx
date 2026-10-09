import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { SignOut } from '@phosphor-icons/react'
import Marca from '../Marca'
import { useSesion } from '../../lib/sesion'

export default function PanelLayout() {
  const { usuario, cargando, salir, puede } = useSesion()
  const ubicacion = useLocation()

  if (cargando) return <div className="panel-cargando esqueleto" aria-label="Cargando sesión" />
  if (!usuario) return <Navigate to="/entrar" state={{ desde: ubicacion.pathname }} replace />

  const enlaces = [
    ['/panel', 'Resumen', true],
    ['/panel/tablero', 'Tablero', true],
    ['/panel/incidentes', 'Incidentes', true],
    ['/panel/auditoria', 'Auditoría', puede('auditoria:ver')],
    ['/panel/usuarios', 'Usuarios', puede('usuario:administrar')],
  ].filter(([, , visible]) => visible)

  return (
    <div className="panel">
      <a href="#panel-contenido" className="saltar">Saltar al contenido</a>
      <header className="panel__cabecera">
        <div className="panel__fila">
          <Marca a="/" />
          <nav aria-label="Panel" className="panel__nav">
            {enlaces.map(([a, texto]) => (
              <NavLink key={a} to={a} end={a === '/panel'} className="panel__enlace">{texto}</NavLink>
            ))}
          </nav>
          <div className="panel__usuario">
            <span className="panel__nombre">
              {usuario.nombre_completo}
              <span className="panel__rol">{usuario.roles.join(', ')}</span>
            </span>
            <button type="button" className="boton boton--fantasma boton--chico" onClick={salir}>
              <SignOut size={18} weight="bold" aria-hidden="true" /> Salir
            </button>
          </div>
        </div>
      </header>
      <main id="panel-contenido" className="panel__contenido">
        <Outlet />
      </main>
    </div>
  )
}
