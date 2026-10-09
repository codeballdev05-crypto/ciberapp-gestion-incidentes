# Auditoría de diseño (revisión final independiente)

**ESTADO:** COMPLETADA · 08/10/2026
**Skill:** `impeccable` (finish review). El revisor fue un agente nuevo, **sin el historial de la construcción**, que recibió el contrato de dirección, el craft floor, las capturas, el informe técnico y el código. Su paso de inicio (lanzador binario) no se ejecutó: es un ejecutable descargable que no se pudo verificar. Se leyeron directamente sus referencias (`new-work.md`, `craft-floor.md`).

## Ronda 1 — disposición `fix`

**Lo que funcionaba (según el revisor):** la primera pantalla se entiende en segundos; el mundo "tablero de fichas" es coherente entre landing y panel (la misma `Ficha.jsx` con datos reales); demuestra en vez de afirmar (respuestas reales de la API, rechazo RN-06 en el historial); no aparecen patrones prohibidos; las superficies del navegador están tematizadas; los estados de carga, vacío y error están cubiertos.

| ID | Sev | Hallazgo | Corrección | Ronda 2 |
|---|---|---|---|---|
| M1 | HIGH | En móvil, la línea del historial se partía y quedaba flotando | `align-content: start` en el libro | ✅ Resuelto |
| M2 | HIGH | En móvil se apilaban las 5 bahías (~1,2 pantallas); el contrato decía "una ficha con su historial" | Modo móvil: riel de 5 estados + una ficha en foco que se sigue de registrado a cerrado + historial | ✅ Resuelto (con N1) |
| M3 | MEDIUM | El rótulo de bahía de la landing no usaba la fuente de rótulo (negrita sintetizada) | `var(--f-rotulo)` 600, igual que el panel | ✅ Resuelto |
| M4 | MEDIUM | El formulario de acciones seguía visible en un incidente cerrado | **Discrepancia fundamentada:** RN-10 permite "nueva acción" después del cierre (D-15 de la API, con pruebas). Se corrigió el texto de la landing y se rotuló "Acción posterior al cierre" con la nota RN-10 | ✅ Discrepancia aceptada por el revisor |
| M5 | MEDIUM | La ficha en vuelo no tenía la elevación que prometía el contrato | `view-transition-class: ficha` + sombra con desplazamiento y desenfoque; duración acotada a `*.ficha` | ✅ Resuelto (verificado en código) |
| M6 | MEDIUM | Faltaba DESIGN.md (condición FINISH) | `docs/DESIGN.md` | ✅ Resuelto |
| Menores | LOW | Halo decorativo, hora ambigua, botones de 36 px en táctil, eje del gráfico gigante, cifras en mono, botón Entrar deshabilitado sin explicación, demo pausada sin aviso | Las 7 corregidas; "colores en Por severidad" no se aplicó (regla de `dataviz`: una serie, un color) | ✅ |

## Ronda 2 — pasada de veredicto: `fix` por hallazgos nuevos, corregidos

| ID | Sev | Hallazgo | Corrección |
|---|---|---|---|
| N1 | MEDIUM | El riel móvil partía "INVESTIGACIÓ / N" | Rótulo corto "investig." (nombre completo en `aria-label` y en la ficha), 12 px, `nowrap` |
| N2 | MEDIUM | En escritorio una bahía acumulaba 3 fichas y el hero crecía mientras animaba | Máximo 2 fichas por bahía + "+n más"; alto mínimo estable |
| N3 | LOW | El historial móvil empezaba con otra ficha | La primera línea es el alta de la ficha en foco |
| N4 | LOW | Hueco de ~120 px entre el hero y el ciclo en móvil | Padding inferior del hero reducido |

Corregidos y verificados con recaptura (`landing-animada-*.png`, 0 violaciones axe, 0 desborde). En la verificación se detectó y corrigió además un error propio: el primer alto fijo de la bahía (15.25 rem) quedaba corto y las fichas se montaban sobre el historial.

## Veredicto
Se alcanzó el tope de **dos rondas** de revisión que fija el proceso. Todos los hallazgos materiales de ambas rondas están corregidos. Los cambios de la ronda 2 se verificaron con capturas propias, no con una tercera revisión independiente.

**Pendiente de sensación (no verificable en capturas):** la fluidez de las View Transitions en vuelo y su sombra. Revisarlas en el navegador (DevTools → Animations, a 2–5× de velocidad).

`TECHNICAL_REVIEW: PASSED` · `HUMAN_STATUS: PENDING`
