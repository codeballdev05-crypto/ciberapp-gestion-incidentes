// Validación automática de estructura (adaptación de .agents/guides/estructura_landing.md
// al stack React + Vite). Falla con código 1 si algo obligatorio falta o si hay
// patrones prohibidos (secretos, SQL o tokens en el frontend).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const obligatorios = [
  'index.html', 'vite.config.js', 'package.json', 'README.md',
  'src/main.jsx', 'src/App.jsx', 'src/lib/api.js', 'src/lib/sesion.jsx',
  'src/styles/tokens.css', 'src/styles/base.css', 'src/styles/componentes.css', 'src/styles/landing.css', 'src/styles/panel.css',
  'src/pages/Landing.jsx', 'src/pages/Entrar.jsx', 'src/components/Ficha.jsx', 'src/components/landing/TableroDemo.jsx',
  'docs/brief_landing.md', 'docs/decisiones_visuales.md', 'docs/fuentes_imagenes.md', 'docs/validacion_final.md',
  'docs/auditorias/diseno.md', 'docs/auditorias/animaciones.md', 'docs/auditorias/accesibilidad.md',
  'docs/auditorias/responsive.md', 'docs/auditorias/rendimiento.md',
  'tools/verificar.mjs',
]
const fallos = obligatorios.filter((f) => !fs.existsSync(path.join(raiz, f))).map((f) => `Falta ${f}`)

const fuentes = []
const recorrer = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name)
  if (e.isDirectory()) recorrer(p); else if (/\.(jsx?|css)$/.test(e.name)) fuentes.push(p)
})
recorrer(path.join(raiz, 'src'))

const prohibidos = [
  [/localStorage|sessionStorage/, 'almacenamiento del navegador (la sesión vive en cookie httpOnly)'],
  [/\b(SELECT|INSERT|UPDATE|DELETE)\s+(\*|INTO|FROM|\w+\s+SET)/, 'SQL en el frontend'],
  [/password\s*[:=]\s*['"][^'"]+['"]|DEMO_PASSWORD|JWT_SECRET|APP_DB_PASSWORD/, 'secreto en el frontend'],
  [/dangerouslySetInnerHTML/, 'HTML sin sanear'],
  [/transition:\s*all/, 'transition: all (skill animate)'],
  [/fonts\.googleapis|unsplash|picsum/, 'recurso externo de terceros'],
]
for (const f of fuentes) {
  // Se ignoran los comentarios: documentar "sin localStorage" no es usarlo.
  const texto = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  for (const [re, motivo] of prohibidos) if (re.test(texto)) fallos.push(`${path.relative(raiz, f)}: ${motivo}`)
}
const lineasLanding = fs.readFileSync(path.join(raiz, 'src/pages/Landing.jsx'), 'utf8').split('\n').length
if (lineasLanding > 320) fallos.push(`Landing.jsx tiene ${lineasLanding} líneas (anti-monolito: máx. 320; extraer secciones)`)

console.log(`Archivos revisados: ${fuentes.length}. Landing.jsx: ${lineasLanding} líneas.`)
if (fallos.length) {
  console.log('TECHNICAL_STATUS: FAILED\n' + fallos.map((x) => ` - ${x}`).join('\n'))
  process.exit(1)
}
console.log('TECHNICAL_STATUS: PASSED')
