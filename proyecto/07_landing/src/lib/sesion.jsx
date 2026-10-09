import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, onSesionExpirada } from './api'

const Contexto = createContext(null)

// Estado de sesión. Los permisos llegan del servidor (/auth/me) y solo sirven para
// mostrar u ocultar controles: la autorización real siempre la decide la API.
export function ProveedorSesion({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [expirada, setExpirada] = useState(false)

  useEffect(() => {
    api.yo()
      .then((r) => setUsuario(r.data))
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false))
    onSesionExpirada(() => {
      setUsuario(null)
      setExpirada(true)
    })
  }, [])

  const entrar = useCallback(async (nombre, contrasena) => {
    const r = await api.login(nombre, contrasena)
    setExpirada(false)
    setUsuario(r.data)
    return r.data
  }, [])

  const salir = useCallback(async () => {
    try { await api.logout() } finally { setUsuario(null) }
  }, [])

  const valor = useMemo(() => ({
    usuario,
    cargando,
    expirada,
    entrar,
    salir,
    puede: (permiso) => Boolean(usuario?.permisos?.includes(permiso)),
  }), [usuario, cargando, expirada, entrar, salir])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useSesion = () => useContext(Contexto)
