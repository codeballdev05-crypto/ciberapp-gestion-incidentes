import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// La API se sirve por proxy bajo el MISMO origen que el frontend:
// la cookie de sesión (httpOnly, SameSite=Strict, Path=/api) viaja sin abrir CORS.
const API = process.env.VITE_API_URL || 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: API, changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: API, changeOrigin: false } },
  },
})
