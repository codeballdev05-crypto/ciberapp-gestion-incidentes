# Brief — Landing y panel de CiberApp (Fase 5)

- **Fecha:** 08/10/2026
- **Skills:** `design-taste-frontend` (creación), `impeccable` (dirección + craft floor), `animate`; auditorías posteriores: `review-animations`, `web-design-guidelines`, `accessibility-compliance`, `responsive-design`.
- **Decisiones humanas (08/10/2026):** dirección visual "Tablero de fichas"; datos reales solo con sesión (la parte pública no expone actividad de seguridad).

## Superficies y modo (impeccable)

| Superficie | Modo | Éxito del visitante |
|---|---|---|
| Landing `/` | **Persuade** | En segundos entiende qué es, por qué importa (rastro que no se borra, reglas que no se saltan) y entra al panel |
| Panel `/panel/*` | **Operate** | Registra, asigna, atiende y cierra incidentes sin dudar del estado ni del siguiente paso |

## Audiencia y escena

- Jefatura de seguridad / TI que evalúa adoptar el sistema, y el docente que evalúa la práctica: leen de día, en oficina, en escritorio o portátil.
- Gestores y analistas que operan el panel durante la jornada, a menudo con varias ventanas abiertas.
- Escena física → tema **claro**: un tablero iluminado, no una sala oscura de película.

## Prueba (no afirmación)

La landing no promete "seguridad de nivel empresarial": **demuestra** el mecanismo. Fichas de incidente avanzan por las 5 columnas del ciclo de vida y cada movimiento añade una línea al historial que no se borra. Los datos de la demostración están marcados como ilustrativos. El estado de la API se consulta en vivo (`GET /api/v1/salud`).

## Direction contract

**THESIS:** Un incidente es una ficha física que avanza por un tablero y deja rastro. Se rechaza el tablero oscuro de SOC con neón verde y la landing SaaS de tres tarjetas con iconos.

**OWN-WORLD:** Tablero de fichas de progreso (control de tráfico aéreo). Fondo gris de bahía `#E3E4DF`, fichas de papel `#FAFAF7` con canto de color por severidad (sage, ante, salmón, ladrillo), tinta `#1A1E26`, un solo acento naranja quemado `#B93D0B` para acciones. Barlow Condensed en rótulos impresos de ficha, Barlow para lectura, JetBrains Mono solo para códigos, horas y hashes. Esquinas de 6 px, reglas de 1 px, sin sombras decorativas: elevación solo en la ficha en movimiento.

**STORY:** El visitante ve el ciclo funcionando → entiende las reglas (no se cierra sin acción, no se reabre sin justificación, nadie borra el historial) → ve qué puede hacer cada rol → entra al panel.

**FIRST VIEWPORT:** A la izquierda (5/12) titular de dos líneas, subtítulo y CTA primario "Entrar al panel" + secundario "Ver cómo funciona". A la derecha (7/12) el tablero vivo: 5 bahías rotuladas, fichas que se desplazan entre bahías y una tira de historial debajo que crece. En móvil: titular, CTA, y el tablero reducido a una ficha con su historial.

**FORM:** Tablero de fichas, 1.º de la lista ordenada (frente a "Expediente / parte" y el canon "Centro de operaciones"). Sin semilla de `impeccable concept-seed`: el lanzador del skill no se ejecutó (binario descargable no verificable); dirección elegida por el humano entre 3 opciones.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Adaptación de las guías del framework

Las guías `.agents/guides/estructura_landing.md` y `reglas_landing.md` corresponden al ejemplo de tienda (PHP, catálogo de 70 productos en Bs). Se conservan sus exigencias **genéricas** (documentación en `docs/`, accesibilidad, rendimiento, política de imágenes, auditorías post-creación, validación de estructura) y se reemplazan las específicas de la tienda. Ver `decisiones_visuales.md` §Adaptación.
