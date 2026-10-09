-- =====================================================================
-- V002__semillas.sql
-- Workflow 02 — Paso 15: Generación SQL (PRODUCCIÓN: NO EJECUTADO AÚN)
-- Contenido: catálogos iniciales (decisión §13: datos de negocio versionados)
--
-- ⚠ REVISIÓN HUMANA REQUERIDA ANTES DE EJECUTAR (hallazgo DB-B09, cerrado con
--   decisión humana 07/10/2026: "set propuesto por el asistente").
--   Los valores de este archivo fueron propuestos por el agente y deben ser
--   revisados/aprobados por el humano antes del Paso 17. RN-03 dice que
--   severidad y prioridad las "define la organización": este set es la propuesta.
--
-- Fuentes: decisiones_base_datos.md §10/§34, reglas_negocio.md RN-02/RN-03,
--          plan_migraciones.md V002.
-- Ejecutar DESPUÉS de V001 (depende de categoria y tipo_incidente).
-- Sin usuarios ni credenciales: los usuarios de aplicación se dan de alta por
--   la aplicación; los roles de BD se gestionan en V004 (sin contraseña aquí).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Estados del ciclo de vida (RN-02, autoridad — 5 estados, 07/10/2026)
--    Nombre exacto exigido por ck_estado_incidente_catalogo (V001).
-- ---------------------------------------------------------------------
INSERT INTO estado_incidente (nombre, descripcion, orden) VALUES
    ('registrado',      'Incidente dado de alta; responsable asignado desde el registro (RN-01)', 1),
    ('asignado',        'Responsable confirmado y atendiendo',                                   2),
    ('en investigación','Análisis en curso; se registran acciones',                               3),
    ('resuelto',        'Resolución propuesta/verificada; falta cierre formal',                   4),
    ('cerrado',         'Cierre confirmado; exige al menos una acción previa (RN-06)',            5);

-- Transiciones permitidas (regla de aplicación en backend, no en BD):
--   registrado → asignado → en investigación → resuelto → cerrado
--   cerrado → en investigación  (reapertura, solo con acción que la justifique — RN-10)

-- ---------------------------------------------------------------------
-- 2. Severidad (RN-03: definida por la organización — PROPUSETA) (RF-021, RN-04)
-- ---------------------------------------------------------------------
INSERT INTO severidad (nombre, descripcion, orden) VALUES
    ('baja',    'Impacto limitado, sin interrupción del servicio',      1),
    ('media',   'Impacto parcial en un servicio o sistema',             2),
    ('alta',    'Impacto significativo o parcial en varios sistemas',   3),
    ('crítica', 'Impacto crítico; exige prioridad alta y atención inmediata (RN-04)', 4);

-- ---------------------------------------------------------------------
-- 3. Prioridad de atención (RF-021, decisiones §6/§8 — PROPUSETA)
-- ---------------------------------------------------------------------
INSERT INTO prioridad (nombre, descripcion, orden) VALUES
    ('baja',  'Atención en horario hábil',        1),
    ('media', 'Atención con plazo razonable',     2),
    ('alta',  'Atención prioritaria',             3);

-- ---------------------------------------------------------------------
-- 4. Categorías (RF-011/RF-020, RN-01/RN-03 — PROPUSETA)
-- ---------------------------------------------------------------------
INSERT INTO categoria (nombre, descripcion, orden) VALUES
    ('acceso no autorizado', 'Intento o logro de acceso sin credenciales válidas', 1),
    ('malware',              'Software malicioso detectado o sospechado',          2),
    ('phishing',             'Engaño para obtener credenciales o datos',           3),
    ('denegación de servicio','Interrupción o degradación del servicio',           4),
    ('fuga de datos',        'Exposición no autorizada de información',            5),
    ('otro',                 'No clasificado en las categorías anteriores',        6);

-- ---------------------------------------------------------------------
-- 5. Tipos por categoría (RF-020 "categoría y tipo" — jerarquía confirmada
--    por esta decisión de semillas 07/10/2026: PROPUSETA)
-- ---------------------------------------------------------------------
INSERT INTO tipo_incidente (categoria_id, nombre, descripcion, orden)
SELECT c.id, t.nombre, t.descripcion, t.orden
FROM (VALUES
    ('acceso no autorizado', 'acceso a cuentas',       'Uso de credenciales ajenas o robadas',   1),
    ('acceso no autorizado', 'acceso a sistemas',      'Acceso a infraestructura sin autorizar', 2),
    ('acceso no autorizado', 'escalamiento de privilegios', 'Obtención de privilegios superiores', 3),
    ('malware',              'ransomware',             'Cifrado o extorsión de datos',           1),
    ('malware',              'troyano',                'Programa con funcionalidad oculta',      2),
    ('malware',              'gusano',                 'Propagación autónoma entre equipos',     3),
    ('malware',              'virus',                  'Código malicioso pegado a archivos',     4),
    ('phishing',             'phishing por correo',    'Correo fraudulento masivo',              1),
    ('phishing',             'spear phishing',         'Ataque dirigido a una persona',          2),
    ('phishing',             'smishing',               'Fraude por mensaje SMS',                 3),
    ('denegación de servicio','dos',                   'Saturación desde una fuente',            1),
    ('denegación de servicio','ddos',                  'Saturación desde múltiples fuentes',     2),
    ('fuga de datos',        'fuga por correo',        'Envío no autorizado de información',     1),
    ('fuga de datos',        'fuga por dispositivo',   'Copia a soportes removibles',            2),
    ('fuga de datos',        'exposición pública',     'Información publicada sin autorización', 3),
    ('otro',                 'otro tipo no clasificado','Pendiente de reclasificación',          1)
) AS t(cat, nombre, descripcion, orden)
JOIN categoria c ON c.nombre = t.cat;

-- ---------------------------------------------------------------------
-- 6. Roles de aplicación (AR-B02/DB-B06, decisión humana 07/10/2026)
--    Matriz funcionalidad×rol detallada se afina en el backend (RNF-002).
-- ---------------------------------------------------------------------
-- (la tabla `rol` no tiene columna `orden`: modelo lógico §2.2)
INSERT INTO rol (nombre, descripcion) VALUES
    ('administrador', 'CRUD total: usuarios, catálogos e incidentes'),
    ('gestor',        'Crear, asignar y cerrar incidentes'),
    ('analista',      'Consultar y atender sus incidentes; registrar acciones y comentarios'),
    ('consultor',     'Solo lectura');

-- =====================================================================
-- Fin de V002. Ningún usuario ni credencial en este script (R-04).
-- Siguiente en el orden: V003__indices.sql
-- =====================================================================
