-- =====================================================================
-- V003__indices.sql
-- Workflow 02 — Paso 15: Generación SQL (PRODUCCIÓN: NO EJECUTADO AÚN)
-- Índices de negocio I-01…I-11 (indices_rendimiento.md §4), decididos por
-- consulta/patrón de acceso (decisiones §14: sin índices "por si acaso").
--
-- Ejecutar DESPUÉS de V001 (y, en la práctica, en el mismo lote: los índices
-- FK subsumidos por estos compuestos no se crean en V001; ver comentarios).
-- En base nueva y vacía se usa CREATE INDEX normal; sobre datos vivos,
-- CREATE INDEX CONCURRENTLY fuera de transacción (plan_migraciones §2).
--
-- Mapeo completo:
--   I-01 → idx_incidente_estado_fecha        (este archivo)
--   I-02 → idx_incidente_prioridad_id        (V001, índice FK)
--   I-03 → idx_incidente_tipo_id / _categoria_id (V001, índices FK)
--   I-04 → idx_incidente_severidad_id        (V001, índice FK)
--   I-05 → idx_incidente_responsable_usuario (este archivo)
--   I-06 → uq_incidente_responsable_vigente  (V001: único parcial, es el CL-07)
--   I-07 → índices FK de accion/comentario/evidencia (V001)
--          e historial vía I-08
--   I-08 → idx_historial_incidente_fecha     (este archivo)
--   I-09 → idx_auditoria_usuario_fecha / idx_auditoria_entidad_registro (este archivo)
--   I-10 → NO se crea (sin requisito de búsqueda de texto libre; §5/§8)
--   I-11 → idx_incidente_fecha_registro      (este archivo)
-- =====================================================================

-- I-01 — Listar incidentes abiertos por fecha de registro (RNF-010, RF-041)
--        Sustituye al índice FK simple sobre estado_id (prefijo de igualdad).
CREATE INDEX idx_incidente_estado_fecha
    ON incidente (estado_id, fecha_registro);

-- I-05 — Incidentes asignados a un responsable (RF-030, decisiones §24)
--        Sustituye al índice FK simple sobre usuario_id.
CREATE INDEX idx_incidente_responsable_usuario
    ON incidente_responsable (usuario_id, fecha_desasignacion);

-- I-08 — Historial de un incidente en orden cronológico (RF-040)
--        Sustituye al índice FK simple sobre incidente_id.
CREATE INDEX idx_historial_incidente_fecha
    ON historial_incidente (incidente_id, fecha);

-- I-09 — Auditoría: operaciones de un usuario / de una entidad en un período
--        (RF-070, RNF-040). El compuesto cubre usuario_id solo (prefijo).
CREATE INDEX idx_auditoria_usuario_fecha
    ON auditoria (usuario_id, fecha);
CREATE INDEX idx_auditoria_entidad_registro
    ON auditoria (entidad, registro_id);

-- I-11 — Fecha de registro para reportes/ordenación global (RF-060).
--        Validar con EXPLAIN en el Paso 19: si I-01 lo cubre en la práctica,
--        eliminar este índice (mantenimiento §7: índices vivos que no se usan).
CREATE INDEX idx_incidente_fecha_registro
    ON incidente (fecha_registro);

-- Índices descartados (indices_rendimiento.md §5): accion/comentario por autor,
-- auditoria(fecha) aislado, fecha_actualizacion, GIN/BRIN/particionados.

-- =====================================================================
-- Fin de V003. Siguiente en el orden: V004__permisos.sql
-- =====================================================================
