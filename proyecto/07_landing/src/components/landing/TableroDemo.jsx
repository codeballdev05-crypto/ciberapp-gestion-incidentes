import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Pause, Play, SkipForward } from '@phosphor-icons/react'
import Ficha from '../Ficha'
import { ESTADOS } from '../../lib/formato'

// Demostración ILUSTRATIVA del ciclo de vida (datos sintéticos, rotulados como tales).
// Reproduce las reglas reales de la API: avance lineal (RN-02), cierre rechazado sin
// acción (RN-06) y un historial que solo crece (RN-07).
const POOL = [
  ['Smishing con enlace de pago falso', 'media', 'media', 'Rocío Quispe'],
  ['Escalamiento de privilegios en APP-02', 'crítica', 'alta', 'Marcelo Antezana'],
  ['Correo dirigido a Gerencia financiera', 'baja', 'baja', 'Rocío Quispe'],
  ['Troyano en portátil de ventas', 'media', 'media', 'Marcelo Antezana'],
  ['Credenciales expuestas en repositorio', 'alta', 'alta', 'Rocío Quispe'],
]

const INICIAL = [
  { id: 1, codigo: 'INC-000231', titulo: 'Phishing a cuentas de nómina', sev: 'media', pri: 'media', resp: 'Rocío Quispe', estado: 0, acciones: 0 },
  { id: 2, codigo: 'INC-000229', titulo: 'Ransomware en servidor de archivos', sev: 'crítica', pri: 'alta', resp: 'Marcelo Antezana', estado: 1, acciones: 0 },
  { id: 3, codigo: 'INC-000226', titulo: 'Acceso desde país no habitual', sev: 'alta', pri: 'alta', resp: 'Rocío Quispe', estado: 2, acciones: 1 },
  { id: 4, codigo: 'INC-000224', titulo: 'Saturación del portal público', sev: 'alta', pri: 'alta', resp: 'Marcelo Antezana', estado: 3, acciones: 0 },
  { id: 5, codigo: 'INC-000219', titulo: 'Copia a USB de informes', sev: 'baja', pri: 'baja', resp: 'Rocío Quispe', estado: 4, acciones: 2 },
]

const PASOS_MIN = [11, 7, 19, 13, 23, 9, 17]
const reloj = (min) => `${String(8 + Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

function inicio() {
  return {
    fichas: INICIAL,
    // N3: la primera línea habla de la ficha que se sigue en móvil (INC-000231).
    libro: [{ id: 0, hora: '08:52', codigo: 'INC-000231', texto: 'registrado · responsable Rocío', tipo: 'normal' }],
    cursor: 0,
    minuto: 60,
    siguienteId: 6,
    siguienteCodigo: 232,
    pool: 0,
    tick: 0,
    foco: 1, // ficha que se sigue en el modo móvil
  }
}

// Un paso de la simulación (función pura). En escritorio avanza por turnos todas
// las fichas activas; en móvil sigue a UNA ficha de principio a fin (revisión M2).
function avanzar(s, movil = false) {
  const minuto = s.minuto + PASOS_MIN[s.tick % PASOS_MIN.length]
  const hora = reloj(minuto % 600)
  let fichas = s.fichas.map((f) => ({ ...f }))
  const lineas = []
  let { siguienteId, siguienteCodigo, pool } = s

  const activas = fichas.filter((f) => f.estado < 4).sort((a, b) => a.codigo.localeCompare(b.codigo))
  const f = movil
    ? activas.find((x) => x.id === s.foco) || activas.find((x) => x.estado === 0) || activas[0]
    : activas[s.cursor % activas.length]

  if (f.estado === 3 && f.acciones === 0) {
    lineas.push({ codigo: f.codigo, texto: 'cierre rechazado: sin acción registrada (RN-06)', tipo: 'rechazo' })
    f.acciones = -1
  } else if (f.acciones === -1) {
    lineas.push({ codigo: f.codigo, texto: 'acción registrada: contención documentada', tipo: 'accion' })
    f.acciones = 1
  } else {
    lineas.push({ codigo: f.codigo, texto: `${ESTADOS[f.estado]} → ${ESTADOS[f.estado + 1]}`, tipo: 'normal' })
    f.estado += 1
  }

  // El tablero mantiene a la vista como máximo dos fichas cerradas.
  // Nunca se retira la ficha que acaba de cerrarse (en móvil es la que se está mostrando).
  const cerradas = fichas.filter((x) => x.estado === 4 && x.id !== f.id)
  if (f.estado === 4 && cerradas.length > 1) fichas = fichas.filter((x) => x.id !== cerradas[0].id)

  // Si la bahía de registro queda vacía, llega un incidente nuevo.
  if (!fichas.some((x) => x.estado === 0)) {
    const [titulo, sev, pri, resp] = POOL[pool % POOL.length]
    const codigo = `INC-${String(siguienteCodigo).padStart(6, '0')}`
    fichas.push({ id: siguienteId, codigo, titulo, sev, pri, resp, estado: 0, acciones: 0 })
    lineas.push({ codigo, texto: `registrado · responsable ${resp.split(' ')[0]}`, tipo: 'normal' })
    siguienteId += 1
    siguienteCodigo += 1
    pool += 1
  }

  const base = s.tick * 10 + 1
  return {
    fichas,
    libro: [...lineas.reverse().map((l, i) => ({ ...l, id: base + i, hora })), ...s.libro].slice(0, 5),
    cursor: s.cursor + 1,
    minuto,
    siguienteId,
    siguienteCodigo,
    pool,
    tick: s.tick + 1,
    // La ficha seguida se muestra un paso en "cerrado"; en el paso siguiente ya no está
    // activa y el foco pasa al incidente en registro (ver selección de `f` arriba).
    foco: f.id,
  }
}

const aIncidente = (f) => ({
  codigo: f.codigo,
  titulo: f.titulo,
  fecha_registro: null,
  severidad: { nombre: f.sev },
  prioridad: { nombre: f.pri },
  estado: { nombre: ESTADOS[f.estado] },
  responsable: { nombre_completo: f.resp },
})

const reduceMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const CONSULTA_MOVIL = '(max-width: 899px)'
// N1: rótulos cortos en el riel móvil (el nombre completo va en el aria-label y en la ficha).
const RIEL_CORTO = { 'en investigación': 'investig.' }

function useMovil() {
  const [movil, setMovil] = useState(() => window.matchMedia(CONSULTA_MOVIL).matches)
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA_MOVIL)
    const cambio = (e) => setMovil(e.matches)
    mq.addEventListener('change', cambio)
    return () => mq.removeEventListener('change', cambio)
  }, [])
  return movil
}

// La ficha en vuelo lleva la clase de transición "ficha": es la única con elevación (contrato OWN-WORLD).
const estiloFicha = (f) => ({ viewTransitionName: `ficha-${f.id}`, viewTransitionClass: 'ficha' })

export default function TableroDemo() {
  const [s, setS] = useState(inicio)
  const [pausado, setPausado] = useState(() => reduceMovimiento())
  const [visible, setVisible] = useState(true)
  const movil = useMovil()
  const raiz = useRef(null)
  const movilRef = useRef(movil)
  useEffect(() => { movilRef.current = movil }, [movil])

  const paso = useCallback(() => {
    const aplicar = () => flushSync(() => setS((e) => avanzar(e, movilRef.current)))
    // View Transitions: cada ficha viaja de su bahía a la siguiente (solo transform).
    if (document.startViewTransition && !reduceMovimiento()) document.startViewTransition(aplicar)
    else aplicar()
  }, [])

  // Solo se anima cuando el tablero está en pantalla y la pestaña visible.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 })
    if (raiz.current) io.observe(raiz.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (pausado || !visible) return undefined
    const t = setInterval(() => { if (!document.hidden) paso() }, 2600)
    return () => clearInterval(t)
  }, [pausado, visible, paso])

  const enFoco = s.fichas.find((f) => f.id === s.foco) || s.fichas.find((f) => f.estado === 0)

  return (
    <figure className="demo" ref={raiz} aria-labelledby="demo-titulo">
      <div className="demo__barra">
        <figcaption id="demo-titulo" className="demo__titulo">
          Tablero de incidentes <span className="demo__marca">demostración con datos ilustrativos</span>
        </figcaption>
        <div className="demo__controles">
          <button type="button" className="boton boton--fantasma boton--chico" onClick={() => setPausado((p) => !p)} aria-pressed={pausado}>
            {pausado ? <Play size={16} weight="bold" aria-hidden="true" /> : <Pause size={16} weight="bold" aria-hidden="true" />}
            {pausado ? 'Reanudar' : 'Pausar'}
          </button>
          <button type="button" className="boton boton--fantasma boton--chico" onClick={paso}>
            <SkipForward size={16} weight="bold" aria-hidden="true" /> Paso
          </button>
        </div>
      </div>

      {movil ? (
        // Móvil: una ficha en foco y el riel de sus cinco estados (contrato FIRST VIEWPORT).
        <div className="demo__foco">
          <ol className="riel" aria-label={`Estado de ${enFoco.codigo}: ${ESTADOS[enFoco.estado]}`}>
            {ESTADOS.map((estado, i) => (
              <li
                key={estado}
                className={`riel__paso${i < enFoco.estado ? ' riel__paso--hecho' : ''}${i === enFoco.estado ? ' riel__paso--actual' : ''}`}
                aria-current={i === enFoco.estado ? 'step' : undefined}
              >
                {RIEL_CORTO[estado] || estado}
              </li>
            ))}
          </ol>
          <Ficha key={enFoco.id} incidente={aIncidente(enFoco)} estilo={estiloFicha(enFoco)} mostrarEstado />
        </div>
      ) : (
        <div className="demo__tablero">
          {ESTADOS.map((estado, i) => {
            const enBahia = s.fichas.filter((f) => f.estado === i)
            return (
              <section key={estado} className="bahia" aria-label={`${estado}: ${enBahia.length} incidente(s)`}>
                <p className="bahia__rotulo" aria-hidden="true">{estado}<span className="bahia__cuenta">{enBahia.length}</span></p>
                <div className="bahia__ranura">
                  {/* N2: como máximo 2 fichas por bahía para que el hero no cambie de alto */}
                  {enBahia.slice(-2).map((f) => <Ficha key={f.id} incidente={aIncidente(f)} estilo={estiloFicha(f)} />)}
                  {enBahia.length > 2 && <p className="bahia__mas">+{enBahia.length - 2} más</p>}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <div className="libro" aria-label="Historial de la demostración (solo se agregan líneas)">
        <p className="libro__rotulo">
          Historial · solo escritura
          {pausado && <span className="libro__pausa"> · en pausa: pulse «Paso» para avanzar</span>}
        </p>
        <ol className="libro__lineas">
          {s.libro.map((l) => (
            <li key={l.id} className={`libro__linea libro__linea--${l.tipo}`}>
              <span className="dato">{l.hora}</span>
              <span className="dato libro__codigo">{l.codigo}</span>
              <span>{l.texto}</span>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  )
}
