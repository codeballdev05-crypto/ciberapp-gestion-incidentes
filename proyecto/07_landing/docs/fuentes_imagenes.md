# Fuentes de imágenes y recursos gráficos

**Fecha de verificación:** 08/10/2026

La landing y el panel **no usan fotografías ni imágenes de terceros**. Cumplen la política
(`.agents/guides/politica_imagenes_landing.md`) por diseño: no hay licencias que verificar ni
dependencias de URLs externas que puedan caerse.

| Recurso | Tipo | Origen | Licencia |
|---|---|---|---|
| Marca y favicon (`public/favicon.svg`, `components/Marca.jsx`) | SVG geométrico (4 rectángulos) | Creado para este proyecto | Propio |
| Fichas, bahías, historial, gráficos | HTML + CSS + SVG generado desde los datos | Creado para este proyecto | Propio |
| Iconos | `@phosphor-icons/react` 2.1 | https://phosphoricons.com | MIT |
| Barlow / Barlow Condensed | `@fontsource/*` (autoalojadas) | Jeremy Tribby, Google Fonts | SIL OFL 1.1 |
| JetBrains Mono | `@fontsource/jetbrains-mono` (autoalojada) | JetBrains | SIL OFL 1.1 |

- No se generaron imágenes con IA.
- No hay `<img>` externas, así que no hace falta fallback ni lazy loading de imágenes.
- Los nombres de personas y casos de la demostración (Rocío Quispe, Marcelo Antezana, INC-000231…) son **ficticios** y están rotulados como "datos ilustrativos".
