-- =====================================================================
-- V006__revocar_create_public.sql
-- Workflow 02 — Paso 19 (08/10/2026): hallazgo de la prueba P-16.
-- En PostgreSQL < 15 el pseudo-rol PUBLIC tiene CREATE sobre el esquema
-- public por defecto. El REVOKE de V004 (sobre app_incidentes) no basta:
-- el privilegio se hereda de PUBLIC y la aplicación podía crear tablas.
-- Corrección (decisiones §17, mínimo privilegio; CVE-2018-1058 hardening):
-- solo migrate_incidentes (GRANT explícito en V004) y el dueño crean objetos.
-- =====================================================================
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
