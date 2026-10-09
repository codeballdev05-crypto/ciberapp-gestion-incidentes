# Auditoría de rendimiento y endurecimiento

**ESTADO:** COMPLETADA · 08/10/2026 · Skills: `web-design-guidelines`, `secure-software-engineering`

## Tamaño del build de producción (`npm run build`)

| Recurso | Tamaño | gzip |
|---|---|---|
| JS (React 19 + router + iconos + app) | 383 kB | **114 kB** |
| CSS | 32 kB | **6.9 kB** |
| Fuentes (7 archivos woff2, solo latín) | ~155 kB | ya comprimidas |

| ID | Sev | Hallazgo | Corrección |
|---|---|---|---|
| P-01 | MEDIUM | Las fuentes incluían cirílico, griego y vietnamita (CSS de 58 kB) | Solo subconjunto latino → CSS de 32 kB |
| P-02 | LOW | Todo el panel va en un único paquete JS | Aceptado para esta fase; mejora futura: `React.lazy` por ruta del panel |
| P-03 | — | Sin imágenes rasterizadas: no hay que optimizar, reservar espacio ni hacer lazy loading | OK |

## Ejecución
- La demo solo anima con el tablero visible y la pestaña activa; el intervalo se limpia al desmontar.
- La búsqueda espera 350 ms antes de consultar (no hay una petición por tecla).
- Los catálogos se piden una sola vez por carga de página.
- Animaciones solo con `transform`/`opacity`; las View Transitions se componen en la GPU.

## Endurecimiento (seguridad del frontend)
| Control | Evidencia |
|---|---|
| Sesión en cookie httpOnly + SameSite=Strict; el JS nunca ve el token | `lib/api.js` (`credentials: 'same-origin'`, sin almacenamiento) |
| Sin `localStorage`, sin SQL, sin secretos, sin `dangerouslySetInnerHTML` | `tools/validar-estructura.mjs` lo comprueba automáticamente |
| Mismo origen por proxy: sin CORS abierto | `vite.config.js` |
| Datos de incidentes solo con sesión (decisión humana 08/10) | La landing pública solo llama a `GET /salud` |
| Sesión expirada → vuelta al login con aviso | `onSesionExpirada` en `lib/api.js` |
| Sin recursos de terceros en ejecución (fuentes autoalojadas) | `fuentes_imagenes.md` |
| La UI oculta acciones según permisos, pero **la API decide** | Probado: un analista que fuerza la URL de un incidente ajeno recibe 404 |

`TECHNICAL_REVIEW: PASSED`
