import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { ProveedorSesion } from './lib/sesion'
import Landing from './pages/Landing'
import Entrar from './pages/Entrar'
import PanelLayout from './components/panel/PanelLayout'
import Resumen from './pages/panel/Resumen'
import Tablero from './pages/panel/Tablero'
import Incidentes from './pages/panel/Incidentes'
import NuevoIncidente from './pages/panel/NuevoIncidente'
import DetalleIncidente from './pages/panel/DetalleIncidente'
import Auditoria from './pages/panel/Auditoria'
import Usuarios from './pages/panel/Usuarios'

function NoEncontrada() {
  return (
    <main className="entrar">
      <div className="entrar__panel">
        <h1>Página no encontrada</h1>
        <p>La dirección no existe. <Link to="/">Volver al inicio</Link>.</p>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ProveedorSesion>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route path="/panel" element={<PanelLayout />}>
            <Route index element={<Resumen />} />
            <Route path="tablero" element={<Tablero />} />
            <Route path="incidentes" element={<Incidentes />} />
            <Route path="incidentes/nuevo" element={<NuevoIncidente />} />
            <Route path="incidentes/:id" element={<DetalleIncidente />} />
            <Route path="auditoria" element={<Auditoria />} />
            <Route path="usuarios" element={<Usuarios />} />
          </Route>
          <Route path="*" element={<NoEncontrada />} />
        </Routes>
      </ProveedorSesion>
    </BrowserRouter>
  )
}
