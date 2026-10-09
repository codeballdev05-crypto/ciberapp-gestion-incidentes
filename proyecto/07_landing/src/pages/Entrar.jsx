import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { SignIn } from '@phosphor-icons/react'
import Marca from '../components/Marca'
import Aviso from '../components/Aviso'
import EstadoApi from '../components/EstadoApi'
import { useSesion } from '../lib/sesion'

export default function Entrar() {
  const { usuario, entrar, expirada } = useSesion()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [form, setForm] = useState({ usuario: '', contrasena: '' })
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario) return <Navigate to={ubicacion.state?.desde || '/panel'} replace />

  async function enviar(e) {
    e.preventDefault()
    setError(null)
    // Validación al enviar, con el error junto al formulario (el botón no se deshabilita sin explicación).
    if (!form.usuario.trim() || !form.contrasena) {
      setError(new Error('Escriba su usuario y su contraseña.'))
      document.getElementById(form.usuario.trim() ? 'contrasena' : 'usuario')?.focus()
      return
    }
    setEnviando(true)
    try {
      await entrar(form.usuario.trim(), form.contrasena)
      navegar(ubicacion.state?.desde || '/panel', { replace: true })
    } catch (err) {
      setError(err)
      setForm((f) => ({ ...f, contrasena: '' }))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="entrar">
      <div className="entrar__panel">
        <Marca />
        <div>
          <h1>Entrar al panel</h1>
          <p className="entrar__bajada">Use su usuario de la organización. Tras 10 intentos fallidos se bloquea el acceso desde su red durante 15 minutos.</p>
        </div>
        {expirada && !error && <div className="aviso" role="status">Su sesión expiró por inactividad. Vuelva a entrar.</div>}
        <Aviso error={error} />
        <form onSubmit={enviar} className="entrar__form" noValidate>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="usuario">Usuario</label>
            <input
              id="usuario"
              className="control"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              required
              value={form.usuario}
              onChange={(e) => setForm({ ...form, usuario: e.target.value })}
            />
          </div>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="contrasena">Contraseña</label>
            <input
              id="contrasena"
              type="password"
              className="control"
              autoComplete="current-password"
              required
              value={form.contrasena}
              onChange={(e) => setForm({ ...form, contrasena: e.target.value })}
            />
          </div>
          <button className="boton boton--primario" disabled={enviando}>
            <SignIn size={18} weight="bold" aria-hidden="true" />
            {enviando ? 'Verificando…' : 'Entrar'}
          </button>
        </form>
        <EstadoApi />
      </div>
    </main>
  )
}
