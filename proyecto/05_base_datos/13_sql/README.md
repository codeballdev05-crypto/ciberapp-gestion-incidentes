# Base de datos — CiberApp (scripts SQL)

Esquema PostgreSQL del sistema de gestión de incidentes de ciberseguridad.
Compatible con **PostgreSQL 12 o superior**.

## Contenido

| Script | Qué hace |
|---|---|
| `V001__esquema_base.sql` | 15 tablas: usuarios y roles, catálogos, incidentes, responsables, acciones, comentarios, evidencias, historial y auditoría. PK identity, 24 FK con `ON DELETE RESTRICT`, UNIQUE, NOT NULL, CHECK e índice único parcial |
| `V002__semillas.sql` | Catálogos iniciales: 5 estados, severidades, prioridades, 6 categorías con 16 tipos y 4 roles |
| `V003__indices.sql` | Índices de negocio, cada uno asociado a una consulta |
| `V004__permisos.sql` | Roles de base de datos (`app_incidentes`, `migrate_incidentes`, `admin_incidentes`) sin contraseña versionada. La aplicación no tiene DELETE y la auditoría es de solo adición |
| `V005__ajuste_permisos_migraciones.sql` | Quita a la aplicación el acceso a la tabla de control de migraciones |
| `V006__revocar_create_public.sql` | Impide que la aplicación cree tablas (`REVOKE CREATE ON SCHEMA public FROM PUBLIC`) |
| `V007__permiso_revocar_roles.sql` | Permite a la aplicación revocar roles de usuario (único DELETE permitido) |

## Cómo crear la base

1. Crear la base vacía:
   ```bash
   psql -U postgres -c "CREATE DATABASE ciberapp;"
   ```
2. Aplicar los scripts **en orden** con el ejecutor de migraciones de la API (recomendado):
   ```bash
   cd proyecto/06_codigo/api
   npm install
   npm run db:migrate
   ```
   El ejecutor aplica cada versión en una transacción, guarda su checksum SHA-256 en
   `schema_migraciones` y no vuelve a aplicar las versiones ya aplicadas.

   Alternativa manual, un script a la vez y en orden:
   ```bash
   psql -U postgres -d ciberapp -1 -f V001__esquema_base.sql
   # … V002 a V007
   ```
3. Asignar la contraseña del rol de la aplicación y crear los usuarios demo:
   `npm run setup` (desde `proyecto/06_codigo/api`). Las contraseñas se guardan
   solo en `.env`, nunca en estos scripts.

## Reglas

- No modificar un script ya aplicado: los cambios van en un `V00N` nuevo.
- Nunca se usa `DROP` ni `TRUNCATE`: incidentes, historial y auditoría no se borran físicamente (RN-07).

## Verificación

Desde `proyecto/06_codigo/api`:
- `npm run db:test`: 21 pruebas de integridad, permisos, auditoría, transacciones y migraciones, ejecutadas con el rol de la aplicación y sin dejar datos.
- `npm run db:docs`: documenta la base real (diagrama E-R y diccionario de datos) y la compara con estos scripts para detectar diferencias.
