# DESIGN.md — CiberApp

Documento del sistema visual que exige el contrato de dirección (FINISH). Fue escrito **después** de construir, a partir de lo que realmente quedó implementado. El detalle y la justificación de cada decisión están en [`decisiones_visuales.md`](decisiones_visuales.md); los valores normativos están en [`src/styles/tokens.css`](../src/styles/tokens.css).

## Mundo
Tablero de fichas de progreso. Un incidente es una ficha; su estado es la bahía en la que está; el historial es un libro que solo crece.

## Tokens
| Grupo | Tokens |
|---|---|
| Superficies | `--bahia #E3E4DF` · `--bahia-honda #D6D8D1` · `--papel #FAFAF7` |
| Tinta | `--tinta #1A1E26` · `--tinta-suave #50565F` · `--regla #C4C7BF` · `--regla-fuerte #9FA39A` |
| Acento (único) | `--acento #B93D0B` · `--acento-hondo #93300A` (también el foco) |
| Severidad (canto) | baja `#4F6E4B` · media `#8F6B16` · alta `#A94E28` · crítica `#8E1B1B` (texto blanco ≥ 4.5:1) |
| Sistema | `--ok #2F6B3A` · `--error #A3221B` |
| Tipo | rótulo Barlow Condensed 600/700 · texto Barlow 400/500/600 · dato JetBrains Mono 400/600 |
| Escala | `--t-xs 0.8125` … `--t-display clamp(2.25→4rem)` |
| Espacio | escala de 4: `--e-1 0.25rem` … `--e-9 7rem` |
| Forma | `--radio 6px` (contenedores) · `--radio-control 4px` |
| Movimiento | `--ease-salida cubic-bezier(0.23,1,0.32,1)` · `--ease-mover cubic-bezier(0.77,0,0.175,1)` · 140 / 220 / 520 ms |

## Componentes
| Componente | Regla |
|---|---|
| Ficha | Canto de severidad con la palabra impresa en vertical; código y hora en mono; título de 2 líneas como máximo; campos SEV/PRI/RESP. Es la misma pieza en la landing y en el panel |
| Bahía | Ranura `--bahia-honda`, rótulo impreso en mayúsculas con contador |
| Riel (móvil) | 5 casillas de estado: hechas en `--regla`, la actual en tinta (`aria-current="step"`) |
| Libro / historial | Línea de 1 px con puntos; las líneas solo se agregan; rechazos en `--error`, acciones en `--ok` |
| Botón | Primario en acento, secundario con borde, tinta, fantasma; 44 px (36 px el chico, 44 px en táctil); pulsación `scale(.97)` |
| Campo | Etiqueta arriba, ayuda y error debajo, `aria-invalid` |
| Chip | Severidad (color + texto) o estado (borde) |
| Respuesta de API | Bloque de tinta en mono: `HTTP` en salmón y el código en blanco |

## Elevación
Borde de 1 px y nada más. **Única sombra:** la ficha en vuelo durante la View Transition (`::view-transition-group(*.ficha)`).

## Movimiento
Un solo momento autoral: la ficha cambia de bahía (520 ms, ease-in-out). Todo lo demás es retroalimentación por debajo de 300 ms. Con movimiento reducido no hay reproducción automática ni desplazamientos.

## Excepciones justificadas
- Monoespaciada solo para datos (códigos, horas, hashes, JSON), nunca como decoración.
- Numeración `1/5 … 5/5` en el ciclo: el orden *es* la información.
- Cifras grandes del resumen en el modo de operación: se ven en una fila con reglas de 1 px, no como tarjetas de "hero-metric".
