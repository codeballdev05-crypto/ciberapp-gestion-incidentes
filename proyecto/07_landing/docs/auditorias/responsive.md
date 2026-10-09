# Auditoría responsive

**ESTADO:** COMPLETADA · 08/10/2026 · Skills: `responsive-design`, `design-taste-frontend` (regla de colapso a una columna en móvil)

## Método
`tools/verificar.mjs` crea un contexto por ancho (1440×900 escritorio; 390×844 móvil con `isMobile` y `hasTouch`), comprueba que `window.innerWidth` coincida con el ancho pedido y mide el desborde horizontal.

## Hallazgo del propio proceso
| ID | Sev | Hallazgo | Corrección |
|---|---|---|---|
| R-00 | HIGH (proceso) | La primera versión del script fijaba el viewport en `newPage()`, que Playwright ignora: las capturas "móviles" eran en realidad de 1280 px y sus mediciones no servían | El viewport se fija en el contexto y el script falla si el ancho real no coincide. Todas las mediciones se repitieron |
| R-01 | HIGH | Hero en 5/12 + 7/12: con 5 bahías en ~730 px, los códigos `INC-000231` se partían y los títulos se cortaban | El titular y la bajada van arriba; el tablero ocupa todo el ancho (5 columnas desde 900 px; en móvil, filas de estado + ficha) |

## Resultado por pantalla (segunda ronda)
Las 10 pantallas, a 1440 y 390 px: **0 px de desborde**. Tablas anchas dentro de contenedores desplazables y accesibles con teclado.

## Comportamiento
| Zona | < 640 px | 640–1079 px | ≥ 1080 px |
|---|---|---|---|
| Hero | Una columna | Una columna | Titular 7/12 + bajada 5/12; tablero a todo el ancho |
| Tablero demo | Filas (estado ⟶ fichas) | Filas hasta 899 px; 5 columnas desde 900 | 5 columnas |
| Ciclo de vida | Apilado | Apilado | 5 columnas desde 900 px |
| Panel: navegación | En una segunda fila con desplazamiento horizontal | Igual | En línea |
| Tablero real | 1 columna | 2 columnas desde 700 px | 5 columnas desde 1100 px |
| Detalle | Una columna | Una columna | 7/12 + 5/12 desde 1000 px |

Altura del hero con `dvh` (sin `h-screen`); márgenes seguros con `env(safe-area-inset-*)` en la cabecera, el pie y el contenedor (`viewport-fit=cover`).

`TECHNICAL_REVIEW: PASSED`
