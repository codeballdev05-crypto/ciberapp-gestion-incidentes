-- =====================================================================
-- V005__ajuste_permisos_migraciones.sql
-- Workflow 02 — Paso 17 (08/10/2026): hallazgo del despliegue real.
-- V004 otorga SELECT/INSERT/UPDATE ON ALL TABLES a app_incidentes, lo que
-- incluyó la tabla de control schema_migraciones (creada por el runner antes
-- de V001). La aplicación no debe leer ni alterar el historial de migraciones
-- (mínimo privilegio, decisiones §17; RNF-022).
-- =====================================================================
REVOKE ALL ON schema_migraciones FROM app_incidentes;
GRANT SELECT ON schema_migraciones TO admin_incidentes;
