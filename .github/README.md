# CiberApp — Gestión de incidentes de ciberseguridad

Sistema web para **registrar, clasificar, asignar, investigar y cerrar incidentes de ciberseguridad**, con un ciclo de vida controlado y un historial que nadie puede borrar.

Trabajo del **Módulo 3 — Desarrollo al lado del cliente y servidor web**
Maestría en Ingeniería de Software y Sistemas Informáticos · Universidad Nacional "Siglo XX" · ESAM

---

## El problema

La organización registraba los incidentes de seguridad por medios dispersos y no podía saber con certeza su **gravedad**, su **estado**, **quién los atendía** ni **qué acciones se habían realizado**.

## La solución

| Capa | Tecnología | Carpeta |
|---|---|---|
| **Frontend** | React 19 + Vite: landing pública y panel de gestión | [`proyecto/07_landing`](../proyecto/07_landing) |
| **Backend** | Node.js 24 + Express 5: API REST JSON con contrato OpenAPI 3.1 | [`proyecto/06_codigo/api`](../proyecto/06_codigo/api) |
| **Base de datos** | PostgreSQL 12 o superior: 15 tablas, 7 migraciones versionadas | [`proyecto/05_base_datos/13_sql`](../proyecto/05_base_datos/13_sql) |

```
Navegador (React)  ──HTTP/JSON──▶  API (Express)  ──SQL──▶  PostgreSQL
 landing + panel      cookie         reglas de negocio       restricciones
                      httpOnly       permisos por rol        auditoría de solo adición
```

### Reglas que el sistema hace cumplir

- **Responsable obligatorio** desde el registro (RN-01).
- **Cinco estados en orden** — registrado → asignado → en investigación → resuelto → cerrado —, sin saltos (RN-02).
- Un incidente **crítico exige prioridad alta** (RN-04).
- **No se cierra sin una acción** documentada (RN-06).
- Un incidente **cerrado no se edita**: se reabre con justificación (RN-10).
- **Historial y auditoría de solo adición**: la aplicación no tiene permiso para modificarlos ni borrarlos (RN-07).
- **Acceso por rol**: administrador, gestor, analista y consultor. El analista solo ve los incidentes que tiene asignados (RN-08).

## Puesta en marcha

Requisitos: **Node.js 20 o superior**, **PostgreSQL 12 o superior** y **Git**.

```bash
git clone https://github.com/codeballdev05-crypto/ciberapp-gestion-incidentes.git
cd ciberapp-gestion-incidentes

# 1. Configuración: copiar la plantilla y completar la conexión a PostgreSQL (DB_PASSWORD)
cp .env.example .env            # en Windows: copy .env.example .env

# 2. Base de datos vacía
psql -U postgres -c "CREATE DATABASE ciberapp;"

# 3. Backend: migraciones, usuarios demo, datos de ejemplo y servidor
cd proyecto/06_codigo/api
npm install
npm run db:migrate              # crea las tablas (V001 a V007)
npm run setup                   # usuarios demo; genera la contraseña en .env
npm run seed:demo               # 10 incidentes de ejemplo
npm run dev                     # http://localhost:3000  ·  docs: /api/docs

# 4. Frontend (en otra terminal)
cd proyecto/07_landing
npm install
npm run dev                     # http://localhost:5173
```

**Usuarios demo:** `admin`, `gestor`, `analista`, `analista2` y `consultor`.
La contraseña la genera `npm run setup` en el `.env` de quien lo ejecuta (`DEMO_PASSWORD`). Ninguna credencial está en el repositorio.

## Verificación

| Prueba | Comando | Resultado |
|---|---|---|
| API | `npm test` (en `api`, tras `npm run db:test-setup`) | 36 de 36 |
| Base de datos | `npm run db:test` (en `api`) | 21 de 21 |
| Accesibilidad, responsive y recorrido funcional | `npm run verificar` (en `07_landing`) | 0 violaciones WCAG 2.1 AA, 0 desbordes |

## Documentación

- [Base de datos](../proyecto/05_base_datos/13_sql/README.md): scripts y cómo crear la base.
- [API](../proyecto/06_codigo/api/README.md): instalación, endpoints, pruebas y seguridad.
- [Frontend](../proyecto/07_landing/README.md): pantallas y verificación; diseño en [`docs/DESIGN.md`](../proyecto/07_landing/docs/DESIGN.md).

---

**Autor:** Luis Alberto Condori Chambi · **Docente:** MSc. Ing. Marcelo Fernando Condori Mendoza
Desarrollado con apoyo de agentes de IA (Claude Code) bajo decisión y revisión del estudiante.
