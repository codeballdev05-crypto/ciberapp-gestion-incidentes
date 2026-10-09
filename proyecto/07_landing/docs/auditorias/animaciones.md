# Auditoría de animaciones

**ESTADO:** COMPLETADA · 08/10/2026 · Skills: `animate` (construcción), `review-animations` (revisión con los estándares de `animate`)

## Superficie de movimiento
Sin librerías de movimiento. CSS + View Transitions API nativa.

| Elemento | Archivo | Propósito | Ingredientes | Veredicto |
|---|---|---|---|---|
| Ficha que cambia de bahía | `TableroDemo.jsx`, `landing.css` (`::view-transition-group`) | Explicación (marketing, poco frecuente) | transform vía VT, 520 ms, ease-in-out fuerte `cubic-bezier(0.77,0,0.175,1)` | ✅ duración > 300 ms justificada: es explicativa, no UI |
| Línea nueva del historial | `landing.css` `.libro__linea` | Indicar estado | `@starting-style`, opacidad + translateY(−4 px), 220 ms ease-out | ✅ |
| Pulsación de botón | `componentes.css` `.boton:active` | Retroalimentación | `scale(0.97)`, 140 ms | ✅ (100–160 ms) |
| Hover de ficha | `componentes.css` `a.ficha:hover` | Retroalimentación sutil | translateY(−1 px), restringido a `(hover: hover) and (pointer: fine)` | ✅ |
| Colores en hover / nav | varios | Estado | `background-color`, `color`, 220 ms; propiedades nombradas | ✅ |
| Esqueleto de carga | `componentes.css` `.esqueleto` | Indicar carga | 1.4 s infinito | ⚠ → ✅ corregido |

## Hallazgos

| ID | Sev | Hallazgo | Corrección |
|---|---|---|---|
| M-01 | MEDIUM | El brillo del esqueleto es movimiento constante con curva ease-out (la tabla de `animate` exige `linear`) | Cambiado a `linear` |
| M-02 | — | Comprobado: sin `transition: all` (también lo vigila `validar-estructura`), sin `ease-in`, sin `scale(0)`, sin animar `width/height/top/left` (las barras del resumen se dibujan con su ancho final, sin animación) | OK |

## Movimiento reducido
- La demo **no se reproduce sola**; el botón "Paso" la avanza sin View Transitions.
- `::view-transition-*` y las animaciones quedan anuladas; el desplazamiento suave se desactiva.
- La demo se pausa fuera de pantalla (IntersectionObserver) y con la pestaña oculta.

## Pendiente de sensación (no verificable solo con código)
Conviene ver el desplazamiento de las fichas a 2–5× de velocidad en DevTools → Animations, para confirmar que 520 ms no se siente lento en pantallas grandes.

`TECHNICAL_REVIEW: PASSED`
