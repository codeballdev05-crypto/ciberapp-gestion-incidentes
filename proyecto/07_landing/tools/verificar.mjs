// Verificación automática de la landing y el panel contra la API real.
// - Capturas desktop (1440) y móvil (390) de cada pantalla → tests/results/
// - Auditoría axe-core (WCAG 2.1 A/AA) por pantalla
// - Desbordamiento horizontal y objetivos táctiles < 24px
// - Recorrido funcional: login → registrar → avanzar estados → acción → cerrar
// Requisitos: API en :3000, Vite en :5173, Microsoft Edge instalado. Uso: npm run verificar
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.dirname(fileURLToPath(import.meta.url))
const SALIDA = path.resolve(raiz, '../tests/results')
const BASE = process.env.BASE_URL || 'http://localhost:5173'
const AXE = fs.readFileSync(path.resolve(raiz, '../node_modules/axe-core/axe.min.js'), 'utf8')
const env = Object.fromEntries(
  fs.readFileSync(path.resolve(raiz, '../../../.env'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
fs.mkdirSync(SALIDA, { recursive: true })

const informe = { fecha: new Date().toISOString(), pantallas: [], flujo: [] }

async function auditar(pagina, nombre, ancho) {
  await pagina.addScriptTag({ content: AXE })
  const axe = await pagina.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })
    return r.violations.map((v) => ({ id: v.id, impacto: v.impact, ayuda: v.help, nodos: v.nodes.length, ejemplo: v.nodes[0]?.target?.join(' ') }))
  })
  const medidas = await pagina.evaluate(() => {
    const desborde = document.documentElement.scrollWidth - document.documentElement.clientWidth
    const pequenos = [...document.querySelectorAll('a, button, input, select, textarea, summary')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.width < 24 || r.height < 24) && getComputedStyle(el).visibility !== 'hidden' })
      .map((el) => `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}"`)
    return { desborde, pequenos }
  })
  informe.pantallas.push({ nombre, ancho, axe, ...medidas })
  console.log(`${nombre} @${ancho}: axe ${axe.length} · desborde ${medidas.desborde}px · táctiles<24 ${medidas.pequenos.length}`)
}

// El viewport se fija en el CONTEXTO (newPage no lo acepta): un contexto por tamaño,
// con la misma sesión (cookies) que el contexto de origen.
async function capturar(contexto, ruta, nombre, { esperar } = {}) {
  const storageState = await contexto.storageState()
  for (const [ancho, alto, sufijo, movil] of [[1440, 900, 'escritorio', false], [390, 844, 'movil', true]]) {
    const ctx = await contexto.browser().newContext({
      storageState, viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil,
      deviceScaleFactor: movil ? 2 : 1, reducedMotion: 'reduce', locale: 'es-ES',
    })
    const pagina = await ctx.newPage()
    await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
    if (esperar) await pagina.waitForSelector(esperar, { timeout: 10000 })
    await pagina.waitForTimeout(300)
    await pagina.screenshot({ path: path.join(SALIDA, `${nombre}-${sufijo}.png`), fullPage: true })
    const real = await pagina.evaluate(() => window.innerWidth)
    if (real !== ancho) throw new Error(`Captura inválida: se pidió ${ancho}px y la página mide ${real}px`)
    await auditar(pagina, nombre, ancho)
    await ctx.close()
  }
}

const navegador = await chromium.launch({ channel: 'msedge', headless: true })
try {
  // Movimiento reducido para capturas estables (el tablero demo queda en pausa).
  const publico = await navegador.newContext({ reducedMotion: 'reduce', locale: 'es-ES' })
  await capturar(publico, '/', 'landing', { esperar: '.estado-api--ok' })
  await capturar(publico, '/entrar', 'entrar')

  // Sesión de gestor
  const gestor = await navegador.newContext({ reducedMotion: 'reduce', locale: 'es-ES' })
  const p = await gestor.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(`${BASE}/entrar`)
  await p.fill('#usuario', 'gestor')
  await p.fill('#contrasena', env.DEMO_PASSWORD)
  await p.click('button:has-text("Entrar")')
  await p.waitForURL('**/panel')
  informe.flujo.push('login gestor → /panel')

  await capturar(gestor, '/panel', 'panel-resumen', { esperar: '.cifras' })
  await capturar(gestor, '/panel/tablero', 'panel-tablero', { esperar: '.tablero .ficha' })
  await capturar(gestor, '/panel/incidentes', 'panel-incidentes', { esperar: '.tabla--incidentes' })
  await capturar(gestor, '/panel/incidentes/nuevo', 'panel-nuevo', { esperar: '#n-titulo' })

  // Recorrido funcional completo por la UI (RF-010 → RF-050)
  await p.goto(`${BASE}/panel/incidentes/nuevo`)
  await p.waitForSelector('#n-categoria_id option:nth-child(2)', { state: 'attached' })
  await p.waitForSelector('#n-responsable_id option:nth-child(2)', { state: 'attached' })
  await p.fill('#n-titulo', `Verificación UI ${Date.now().toString(36)}`)
  await p.fill('#n-descripcion', 'Incidente creado por la verificación automática del frontend.')
  await p.selectOption('#n-categoria_id', { label: 'malware' })
  await p.selectOption('#n-tipo_id', { label: 'ransomware' })
  await p.selectOption('#n-severidad_id', { label: 'crítica' })
  const prioridadFijada = await p.$eval('#n-prioridad_id', (s) => s.disabled && s.selectedOptions[0].textContent)
  informe.flujo.push(`RN-04 en UI: severidad crítica fija prioridad → ${prioridadFijada}`)
  await p.selectOption('#n-responsable_id', { index: 1 })
  await p.click('button:has-text("Registrar incidente")')
  await p.waitForURL(/\/panel\/incidentes\/\d+$/)
  const codigo = await p.textContent('.migas .dato')
  informe.flujo.push(`registrado ${codigo}`)

  for (const paso of ['asignado', 'en investigación', 'resuelto']) {
    await p.click(`button:has-text("Pasar a ${paso}")`)
    await p.click('button:has-text("Confirmar")')
    await p.waitForSelector(`.detalle__estado:has-text("${paso}")`)
    informe.flujo.push(`→ ${paso}`)
  }
  await p.click('button:has-text("Cerrar incidente")')
  const bloqueado = await p.isDisabled('button:has-text("Confirmar")')
  informe.flujo.push(`RN-06 en UI: cierre sin acciones bloqueado → ${bloqueado}`)
  await p.click('button:has-text("Cancelar")')
  await p.fill('#a-desc', 'Restauración desde respaldo verificada')
  await p.click('button:has-text("Registrar acción")')
  await p.waitForSelector('.entradas li')
  await p.click('button:has-text("Cerrar incidente")')
  await p.click('button:has-text("Confirmar")')
  await p.waitForSelector('.detalle__estado:has-text("cerrado")')
  informe.flujo.push('→ cerrado (con 1 acción)')
  const lineas = await p.$$eval('.historial--panel li', (l) => l.length)
  informe.flujo.push(`historial con ${lineas} líneas`)
  const url = p.url().replace(BASE, '')
  await capturar(gestor, url, 'panel-detalle', { esperar: '.historial--panel' })

  // Analista: solo ve lo suyo (RN-08)
  const analista = await navegador.newContext({ reducedMotion: 'reduce', locale: 'es-ES' })
  const a = await analista.newPage({ viewport: { width: 1440, height: 900 } })
  await a.goto(`${BASE}/entrar`)
  await a.fill('#usuario', 'analista2')
  await a.fill('#contrasena', env.DEMO_PASSWORD)
  await a.click('button:has-text("Entrar")')
  await a.waitForURL('**/panel')
  const navAnalista = await a.$$eval('.panel__enlace', (l) => l.map((x) => x.textContent))
  informe.flujo.push(`analista2 navegación: ${navAnalista.join(', ')}`)
  await capturar(analista, '/panel', 'panel-analista', { esperar: '.lista-fichas, .vacio' })

  // Admin: auditoría y usuarios
  const admin = await navegador.newContext({ reducedMotion: 'reduce', locale: 'es-ES' })
  const ad = await admin.newPage()
  await ad.goto(`${BASE}/entrar`)
  await ad.fill('#usuario', 'admin')
  await ad.fill('#contrasena', env.DEMO_PASSWORD)
  await ad.click('button:has-text("Entrar")')
  await ad.waitForURL('**/panel')
  await capturar(admin, '/panel/auditoria', 'panel-auditoria', { esperar: '.tabla' })
  await capturar(admin, '/panel/usuarios', 'panel-usuarios', { esperar: '.tabla' })
} finally {
  await navegador.close()
}

fs.writeFileSync(path.join(SALIDA, 'informe.json'), JSON.stringify(informe, null, 2))
const totalAxe = informe.pantallas.reduce((s, x) => s + x.axe.length, 0)
console.log('\nFlujo:', informe.flujo.join(' | '))
console.log(`Total violaciones axe: ${totalAxe} · pantallas con desborde: ${informe.pantallas.filter((x) => x.desborde > 0).length}`)
