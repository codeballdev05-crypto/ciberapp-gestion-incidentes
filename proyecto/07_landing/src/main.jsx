import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fuentes autoalojadas (sin peticiones a terceros): solo los pesos usados.
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-500.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-600.css'

import './styles/tokens.css'
import './styles/base.css'
import './styles/componentes.css'
import './styles/landing.css'
import './styles/panel.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
