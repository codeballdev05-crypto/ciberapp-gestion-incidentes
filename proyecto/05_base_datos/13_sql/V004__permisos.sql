-- =====================================================================
-- V004__permisos.sql
-- Workflow 02 — Paso 15: Generación SQL (PRODUCCIÓN: NO EJECUTADO AÚN)
-- Usuarios/roles de base de datos y permisos (seguridad.md §3, decisión §17,
-- plan_migraciones V004, RNF-022/RN-07, RF-070).
--
-- ⚠ CREDENCIALES: este archivo NO contiene contraseñas ni secretos (R-04).
--   Los roles se crean aquí sin contraseña asignada; la asignación se hace
--   desde el entorno (Paso 16, operación humana) y jamás se escribe en un
--   archivo del repositorio. La aplicación solo la consume vía `.env`.
--   Ejecutar V004 como superusuario o rol con ADMIN OPTION sobre los roles.
--
-- Orden: después de V001/V002/V003 (usa ALL TABLES IN SCHEMA).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Roles (idempotente: no falla si ya existen)
--    Sin HERENCIAS de superusuario; sin contraseña versionada.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_incidentes') THEN
        CREATE ROLE app_incidentes LOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migrate_incidentes') THEN
        CREATE ROLE migrate_incidentes LOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_incidentes') THEN
        CREATE ROLE admin_incidentes LOGIN;
    END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 2. Esquema
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO app_incidentes, migrate_incidentes, admin_incidentes;

-- ---------------------------------------------------------------------
-- 3. Usuario de aplicación (mínimo privilegio — decisiones §17)
--    SELECT/INSERT/UPDATE sobre tablas de negocio; SIN DELETE en ninguna
--    tabla (RN-07/decisión §23: el borrado físico no es operación normal).
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_incidentes;

-- Append-only (RNF-022, RN-07): sin UPDATE ni DELETE sobre bitácora e historial.
REVOKE UPDATE ON historial_incidente, auditoria FROM app_incidentes;

-- La aplicación tampoco modifica la estructura:
REVOKE CREATE ON SCHEMA public FROM app_incidentes;

-- ---------------------------------------------------------------------
-- 4. Usuario de migraciones (DDL — decisión §13)
-- ---------------------------------------------------------------------
GRANT CREATE ON SCHEMA public TO migrate_incidentes;

-- ---------------------------------------------------------------------
-- 5. Usuario administrativo (operación humana: respaldos, creación de roles)
-- ---------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO admin_incidentes;

-- ---------------------------------------------------------------------
-- 6. Privilegios por defecto para objetos futuros
--    (creados por migrate_incidentes durante las migraciones)
-- ---------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE migrate_incidentes IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE ON TABLES TO app_incidentes;
ALTER DEFAULT PRIVILEGES FOR ROLE migrate_incidentes IN SCHEMA public
    GRANT ALL ON TABLES TO admin_incidentes;
ALTER DEFAULT PRIVILEGES FOR ROLE migrate_incidentes IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_incidentes, admin_incidentes;

-- Verificación esperada tras aplicar (Paso 18, database-documentation):
--   * app_incidentes NO puede: UPDATE/DELETE sobre historial_incidente/auditoria,
--     DELETE sobre ninguna tabla, CREATE/ALTER/DROP.
--   * migrate_incidentes puede DDL; admin_incidentes todo en tablas.
-- =====================================================================
-- Fin de V004 (última migración inicial del plan V001–V004).
-- =====================================================================
