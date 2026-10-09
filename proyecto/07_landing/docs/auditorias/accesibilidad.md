# Auditoría UI/UX y accesibilidad

**ESTADO:** COMPLETADA · 08/10/2026

## Skills utilizados
`accessibility-compliance`, `web-design-guidelines`, con **axe-core 4** (WCAG 2.0/2.1 A y AA + buenas prácticas) ejecutado por `tools/verificar.mjs` sobre 10 pantallas × 2 anchos (1440 y 390).

## Archivos revisados
`src/pages/**`, `src/components/**`, `src/styles/**`; evidencia en `tests/results/informe.json` y `tests/results/*.png`.

## Hallazgos y correcciones

| ID | Sev | Hallazgo (primera ronda) | Corrección | Estado |
|---|---|---|---|---|
| A-01 | HIGH | `color-contrast`: texto blanco sobre los cantos de severidad baja (#7E9C7A ≈ 3.1:1), media y alta | Tonos oscurecidos a #4F6E4B / #8F6B16 / #A94E28 (≥ 4.5:1) | ✅ |
| A-02 | HIGH | `label-content-name-mismatch`: el `aria-label` de la ficha enlazada no contenía el texto visible | Se quitó el `aria-label`; el nombre accesible es el contenido real de la ficha | ✅ |
| A-03 | MEDIUM | `heading-order`: rótulos `h3` de la demo sin `h2` previo | Rótulos como texto; cada bahía es una `section` con `aria-label` | ✅ |
| A-04 | HIGH | `scrollable-region-focusable` (390 px): tablas desplazables no alcanzables con teclado | `tabIndex=0`, `role="region"` y `aria-label` en los contenedores de tabla | ✅ |
| A-05 | LOW | Objetivos < 24 px: enlaces de código en la tabla de incidentes y casillas de roles (17 px) | Los enlaces van dentro del texto (excepción de WCAG 2.5.8); las casillas tienen una etiqueta `<label>` de 32 px de alto que amplía el área clicable | Documentado |

## Controles presentes
- Enlace "Saltar al contenido" en la landing y en el panel; landmarks `header/nav/main/footer`.
- Foco visible propio (2 px, color de acento) en todos los controles.
- Formularios con etiqueta arriba, ayuda y error debajo, `aria-invalid` y `aria-describedby`; el foco salta al primer campo con error.
- Errores de la API en `role="alert"`; estado de la API en `role="status"`.
- Severidad y estado comunicados con texto además del color.
- Demo animada con **pausa** (WCAG 2.2.2) y sin reproducción automática con `prefers-reduced-motion`.
- Gráficos con `role="img"` + descripción + tabla equivalente.
- Analista: un incidente ajeno responde "no existe o no tiene acceso" (no revela información).

## Evidencia
Segunda ronda: **0 violaciones axe en 20 capturas**, 0 px de desborde horizontal.

`TECHNICAL_REVIEW: PASSED`
