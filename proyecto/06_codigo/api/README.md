# API — CiberApp

API REST JSON del sistema de gestión de incidentes de ciberseguridad.
**Node.js 24 · Express 5 · PostgreSQL (pg, SQL explícito) · zod · sesión en cookie httpOnly.**

- Contrato: [`openapi/openapi.yaml`](openapi/openapi.yaml) (OpenAPI 3.1). Con la API en marcha, la documentación interactiva está en `http://localhost:3000/api/docs`.
- Esquema de base de datos: [`../../05_base_datos/13_sql`](../../05_base_datos/13_sql).

## Puesta en marcha

Requisitos: **Node.js 20 o superior** y **PostgreSQL 12 o superior**.

1. **Configuración**, en la raíz del repositorio:
   ```bash
   copy .env.example .env        # en Linux o macOS: cp .env.example .env
   ```
   Completar en `.env` la conexión administrativa: `DB_HOST`, `DB_PORT`, `DB_NAME=ciberapp`, `DB_USER` y `DB_PASSWORD`.
   El resto de variables las genera el paso 4.

2. **Crear la base vacía:**
   ```bash
   psql -U postgres -c "CREATE DATABASE ciberapp;"
   ```

3. **Instalar y migrar**, desde esta carpeta:
   ```bash
   npm install
   npm run db:migrate     # aplica V001 a V007
   ```

4. **Preparar el entorno y cargar datos de ejemplo:**
   ```bash
   npm run setup          # rol de la app + usuarios demo; genera los secretos en .env
   npm run seed:demo      # 10 incidentes de ejemplo (solo si la base está vacía)
   ```

5. **Iniciar:**
   ```bash
   npm run dev            # http://localhost:3000
   ```

**Usuarios demo:** `admin`, `gestor`, `analista`, `analista2` y `consultor`.
La contraseña la genera `npm run setup` y queda en `.env` como `DEMO_PASSWORD`.

## Pruebas

```bash
npm run db:test-setup   # crea o actualiza la base aislada ciberapp_test (no borra nada)
npm test                # 36 pruebas de la API contra ciberapp_test
npm run db:test         # 21 pruebas de la base de datos
```

## Endpoints principales (`/api/v1`)

| Método y ruta | Qué hace | Roles |
|---|---|---|
| `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` | Sesión | todos |
| `GET /catalogos` | Catálogos y máquina de estados | con sesión |
| `GET /incidentes` | Búsqueda con filtros y paginación | con sesión (el analista solo ve los suyos) |
| `POST /incidentes` | Registro (responsable obligatorio; crítica ⇒ prioridad alta) | gestor, admin |
| `GET` · `PATCH /incidentes/{id}` | Detalle e historial · edición con control de versión | con sesión · gestor, admin |
| `POST /incidentes/{id}/estado` | Transición de estado (cierre con acción; reapertura justificada) | según la transición |
| `POST /incidentes/{id}/asignacion` | Reasignar responsable | gestor, admin |
| `POST /incidentes/{id}/acciones` · `/comentarios` · `/evidencias` | Atención del incidente | admin, gestor, analista |
| `GET` · `POST` · `PATCH /usuarios` | Usuarios y roles | admin (el gestor solo lista) |
| `GET /reportes/resumen` · `GET /auditoria` | Indicadores · bitácora | admin, gestor, consultor · admin |

Errores con formato único: `{ "error": { "codigo", "mensaje", "detalles?" } }`.

## Estructura

```
src/config      configuración (.env)
src/db          pool de conexiones y transacciones
src/middleware  autenticación, permisos por rol, errores
src/modulos     auth · catalogos · incidentes · usuarios · reportes
src/utils       validación (zod), errores de dominio, auditoría
scripts/        migraciones, setup, datos demo, documentación y pruebas de la BD
test/           pruebas de la API
openapi/        contrato OpenAPI 3.1
```

## Seguridad

- La API se conecta con el rol `app_incidentes`, de mínimo privilegio: no puede borrar incidentes, modificar la auditoría ni crear tablas.
- Las contraseñas se guardan con bcrypt, y el login se bloquea tras 10 intentos fallidos en 15 minutos por IP.
- Ninguna credencial está en el repositorio: todas viven en `.env`, que está excluido por `.gitignore`.
