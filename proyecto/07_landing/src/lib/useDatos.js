import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

// Carga asíncrona con estados explícitos (cargando / error / datos) y recarga.
export function useDatos(cargar, deps = []) {
  const [estado, setEstado] = useState({ cargando: true, error: null, datos: null })
  const ref = useRef(cargar)
  ref.current = cargar

  const recargar = useCallback(() => {
    let vigente = true
    setEstado((e) => ({ ...e, cargando: true, error: null }))
    ref.current()
      .then((datos) => vigente && setEstado({ cargando: false, error: null, datos }))
      .catch((error) => vigente && setEstado({ cargando: false, error, datos: null }))
    return () => { vigente = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => recargar(), [recargar])
  return { ...estado, recargar }
}

// Catálogos: se piden una vez por sesión de página.
let cacheCatalogos = null
export function useCatalogos() {
  return useDatos(() => {
    if (!cacheCatalogos) cacheCatalogos = api.catalogos().then((r) => r.data).catch((e) => { cacheCatalogos = null; throw e })
    return cacheCatalogos
  })
}
