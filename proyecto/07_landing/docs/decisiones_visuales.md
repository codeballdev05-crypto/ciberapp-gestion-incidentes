# Decisiones visuales (sistema de diseño — equivalente a DESIGN.md)

- **Fecha:** 08/10/2026 · **Skills:** `impeccable` (dirección, craft floor), `design-taste-frontend`, `animate`, `dataviz`
- **Dirección:** "Tablero de fichas" (decisión humana 08/10/2026 entre 3 opciones; contrato en `brief_landing.md`)
- **Fuente de verdad de los valores:** `src/styles/tokens.css`

## 1. Por qué este mundo

El mecanismo propio del producto es que **un incidente atraviesa estados controlados y deja un rastro que no se borra**. Las fichas de progreso del control de tráfico aéreo son un objeto que encarna ese mecanismo: cada ficha es un caso, la columna es su estado y el tablero es la situación. Se descartó el canon del sector (tema oscuro de SOC, neón verde, candados) porque cualquiera lo adivinaría a partir de la categoría.

## 2. Color — estrategia "contenida + severidad funcional"

| Rol | Token | Valor | Uso | Contraste verificado |
|---|---|---|---|---|
| Fondo de tablero | `--bahia` | `#E3E4DF` | Fondo de página | — |
| Ficha / papel | `--papel` | `#FAFAF7` | Superficies de contenido | — |
| Tinta | `--tinta` | `#1A1E26` | Texto, barra del panel (nunca negro puro) | 15.6:1 sobre papel |
| Tinta suave | `--tinta-suave` | `#50565F` | Texto secundario | 7.0:1 sobre papel · 5.6:1 sobre bahía |
| **Acento único** | `--acento` | `#B93D0B` | Acción primaria, foco, cifras de regla | blanco sobre acento 6.0:1 |
| Severidad baja / media / alta / crítica | `--sev-*` | `#4F6E4B` / `#8F6B16` / `#A94E28` / `#8E1B1B` | Canto de la ficha (con la palabra impresa) | blanco ≥ 4.5:1 en los cuatro (corregido tras la auditoría axe) |

**La severidad nunca se comunica solo con color:** el canto lleva la palabra impresa y la ficha repite "SEV baja/media/…" en texto.

Tema claro por la escena de uso (oficina, de día; tablero iluminado), no por la categoría.

## 3. Tipografía (autoalojada, solo subconjunto latino, sin peticiones a terceros)

| Rol | Familia | Por qué |
|---|---|---|
| Rótulos, títulos, botones | **Barlow Condensed** 600/700 | Letra estrecha de rótulo impreso, como los campos de una ficha o la señalética |
| Lectura | **Barlow** 400/500/600 | De la misma familia, legible en párrafos |
| Datos | **JetBrains Mono** 400/600 | **Solo** códigos (INC-000231), horas, hashes y respuestas de la API, con cifras tabulares |

Escala fluida con `clamp()`; display máximo 4 rem; tracking mínimo −0.025 em; ancho de texto ≤ 65 ch.

## 4. Componentes clave

- **Ficha** (`components/Ficha.jsx`): casilla de severidad vertical, código y hora en mono, título de 2 líneas como máximo, campos SEV/PRI/RESP. Es la misma pieza en la landing (demo) y en el panel (datos reales).
- **Bahía**: ranura gris con rótulo en mayúsculas y contador.
- **Libro / historial**: línea vertical de 1 px con puntos; las líneas solo se agregan.
- **Respuesta de API**: bloque oscuro en mono que muestra el error real (código + mensaje). Es la prueba de cada regla.
- Elevación declarada una sola vez: borde de 1 px, sin sombras decorativas. Radios de 6 px en contenedores y 4 px en controles.

## 5. Movimiento (skill `animate`)

| Movimiento | Frecuencia / propósito | Ingredientes |
|---|---|---|
| **Ficha que cambia de bahía (momento autoral)** | Rara, solo en marketing / explicación | View Transitions API, `transform`, 520 ms, `cubic-bezier(0.77, 0, 0.175, 1)` (mover en pantalla) |
| Línea nueva del historial | Acompaña al anterior / indica estado | `@starting-style`, opacidad + 4 px, 220 ms ease-out |
| Pulsación de botón | Retroalimentación | `scale(0.97)`, 140 ms |
| Hover de ficha enlazada | Decenas por sesión, casi imperceptible | `translateY(-1px)`, solo con `(hover: hover) and (pointer: fine)` |
| Brillo del esqueleto | Indica carga | 1.4 s `linear` (movimiento constante) |

Con **movimiento reducido** la demo no se reproduce sola (se avanza con "Paso") y no hay desplazamientos; se conservan los cambios de color. Hay control de **pausa** (WCAG 2.2.2) y la animación se detiene fuera de pantalla o con la pestaña oculta.

## 6. Visualización de datos (skill `dataviz`)

Totales como cifras (no gráfico); barras horizontales de una sola serie en tinta (sin leyenda: el título nombra la serie, valores en texto); columnas de 30 días con tooltip al pasar el cursor y **tabla equivalente** desplegable. Sin paleta categórica, por lo que no aplica el validador de paletas.

## 7. Adaptación de las guías del framework

| Guía (ejemplo de tienda) | Decisión en este proyecto |
|---|---|
| PHP 8 + MySQL + PDO; React y Vite prohibidos "sin decisión explícita" | **Decisión humana explícita 08/10/2026:** React + Vite; la API es Node (fase 4) |
| Catálogo de 7 × 10 productos con precios en Bs | No aplica (no es una tienda). El "catálogo" equivalente son los catálogos de la API |
| Runtime de BD solo lectura con Repository | La landing **no accede a la BD**: consume la API REST. El SQL vive solo en la API |
| Estructura `app/ config/ public/` | Estructura React: `src/pages`, `src/components`, `src/lib`, `src/styles` (capas CSS equivalentes: tokens, base, componentes, landing, panel) |
| Regla anti-monolito (index ≤ 140 líneas, sin SQL en vistas) | `tools/validar-estructura.mjs`: sin SQL, sin secretos ni `localStorage` en el front, Landing.jsx ≤ 320 líneas |
| Política de imágenes | Cumplida sin fotografías: ver `fuentes_imagenes.md` |
| Auditorías post-creación (visual, motion, a11y, responsive, rendimiento, estructura, humano) | `docs/auditorias/*.md` + aprobación humana pendiente |
