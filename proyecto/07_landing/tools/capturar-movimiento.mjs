// Capturas de la demo CON movimiento (sin prefers-reduced-motion), tras varios pasos,
// para revisar la coreografía que las capturas en pausa no muestran.
import { chromium } from 'playwright-core'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SALIDA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../tests/results')
const BASE = process.env.BASE_URL || 'http://localhost:5173'
const b = await chromium.launch({ channel: 'msedge', headless: true })
for (const [ancho, alto, nombre, movil] of [[1440, 900, 'escritorio', false], [390, 844, 'movil', true]]) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, reducedMotion: 'no-preference', locale: 'es-ES' })
  const p = await ctx.newPage()
  await p.goto(BASE, { waitUntil: 'networkidle' })
  await p.waitForTimeout(2600 * 6 + 900) // seis pasos de la simulación
  // Pausar y dejar terminar la View Transition en curso: una captura a mitad de vuelo
  // muestra las imágenes vieja y nueva superpuestas y no es evidencia válida.
  await p.click('button:has-text("Pausar")')
  await p.waitForTimeout(900)
  await p.screenshot({ path: path.join(SALIDA, `landing-animada-${nombre}.png`) })
  await ctx.close()
}
await b.close()
console.log('Capturas con movimiento: landing-animada-escritorio.png, landing-animada-movil.png')
