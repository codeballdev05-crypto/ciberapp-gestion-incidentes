# CiberApp — Landing y panel

Landing pública y panel de gestión de incidentes de ciberseguridad, conectados a la API
REST (`proyecto/06_codigo/api`). React 19 + Vite + React Router; CSS propio por capas.

## Ejecutar

Necesita la API corriendo en `http://localhost:3000`. Para la base de datos y la API, ver
[`../06_codigo/api/README.md`](../06_codigo/api/README.md).

```bash
# terminal 1 — API
cd proyecto/06_codigo/api && npm run dev

# terminal 2 — frontend
cd proyecto/07_landing
npm install
npm run dev            # http://localhost:5173
```

Vite redirige `/api/*` a la API (mismo origen), así la cookie de sesión funciona sin CORS.
Otra URL de API: `VITE_API_URL=http://host:puerto npm run dev`.

Usuarios demo: `admin`, `gestor`, `analista`, `analista2`, `consultor` (contraseña: `DEMO_PASSWORD` en `.env`).

## Pantallas

| Ruta | Acceso | Qué hace |
|---|---|---|
| `/` | Público | Landing: tablero demo animado, ciclo de vida, reglas con la respuesta real de la API, rastro, roles; estado de la API en vivo |
| `/entrar` | Público | Inicio de sesión |
| `/panel` | Con sesión | Indicadores (gestor/consultor/admin) o "mis incidentes" (analista) |
| `/panel/tablero` | Con sesión | Tablero de fichas con datos reales |
| `/panel/incidentes` | Con sesión | Búsqueda y filtros en la URL, paginación |
| `/panel/incidentes/nuevo` | gestor, admin | Registro con RN-01 y RN-04 en la interfaz |
| `/panel/incidentes/:id` | Con sesión | Detalle: siguiente paso, reasignar, editar, acciones, comentarios, evidencias, historial |
| `/panel/auditoria` | admin | Bitácora |
| `/panel/usuarios` | admin | Alta, roles, activar/desactivar |

## Verificación

```bash
npm run build                # build de producción
npm run lint                 # oxlint
npm run validar-estructura   # estructura + prohibiciones (SQL, secretos, localStorage…)
npm run verificar            # capturas 1440/390 + axe + desborde + recorrido funcional
```

`npm run verificar` necesita la API y Vite en marcha y Microsoft Edge instalado (lo usa sin interfaz mediante playwright-core).

Resultados en `tests/results/` (capturas `.png` e `informe.json`).

## Documentación
- `docs/brief_landing.md` — brief y contrato de dirección
- `docs/decisiones_visuales.md` — sistema de diseño (tokens, tipografía, movimiento, adaptación de guías)
- `docs/fuentes_imagenes.md` — procedencia de recursos
- `docs/auditorias/` — diseño, animaciones, accesibilidad, responsive, rendimiento
- `docs/validacion_final.md` — veredicto de la fase
