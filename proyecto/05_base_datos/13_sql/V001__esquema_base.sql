-- =====================================================================
-- V001__esquema_base.sql
-- Workflow 02 — Paso 15: Generación SQL (PRODUCCIÓN: NO EJECUTADO AÚN)
-- Proyecto: Sistema Web de Gestión y Seguimiento de Incidentes de Ciberseguridad
-- Motor: PostgreSQL (decisión humana 07/10/2026). Servidor real verificado en
--        Paso 16: PostgreSQL 12.2 — script compatible con PG >= 12.
-- Autorización: revision_dba.md = STATUS: APPROVED (Paso 14) y
--               08_recomendacion_final.md = STATUS: APPROVED (ADR, 07/10/2026)
-- Skills: database-schema-designer + databases + postgresql-table-design
-- Fuentes: 05_modelo_fisico/modelo_fisico.md, 03_modelo_logico/modelo_logico.md,
--          06_integridad/integridad.md, 12_migraciones/plan_migraciones.md
--
-- Contenido: 15 tablas con PK identity, FK ON DELETE RESTRICT, UNIQUE,
--            NOT NULL, CHECK y DEFAULT; índices FK/UNIQUE (negocio en V003).
-- Convenciones: snake_case; TEXT + CHECK (no varchar(n)); TIMESTAMPTZ;
--               BIGINT GENERATED ALWAYS AS IDENTITY (no SERIAL); sin triggers.
-- Credenciales: NINGUNA en este archivo (R-04). Usuarios de BD en V004 sin
--               contraseña; la contraseña se configura fuera del versionado.
-- Ejecución: aún NO autorizada. Paso 17 con autorización humana explícita.
--            Usar transacción única: psql -1 -f V001__esquema_base.sql
--            (el envoltorio de transacción lo aporta la herramienta de
--             migraciones; DB-B08 pendiente de confirmar con backend).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Seguridad y usuarios (modelo conceptual §2.1)
-- ---------------------------------------------------------------------

CREATE TABLE usuario (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario           TEXT NOT NULL,
    credencial_hash   TEXT NOT NULL,      -- CL-09 / RNF-004: jamés texto plano
    nombre_completo   TEXT NOT NULL,
    correo            TEXT,
    activo            BOOLEAN NOT NULL DEFAULT true,   -- inactivación lógica (decisión §12)
    fecha_alta        TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_acceso     TIMESTAMPTZ,
    CONSTRAINT uq_usuario_usuario UNIQUE (usuario),
    -- Ajuste Paso 16 (08/10/2026): servidor real = PostgreSQL 12.2 (no 18.6).
    -- UNIQUE NULLS NOT DISTINCT (PG15+) no existe en PG12 y además impedía más de
    -- un usuario sin correo (columna opcional). UNIQUE estándar: varios NULL permitidos.
    CONSTRAINT uq_usuario_correo  UNIQUE (correo),
    CONSTRAINT ck_usuario_usuario_largo CHECK (LENGTH(usuario) <= 50),
    CONSTRAINT ck_usuario_nombre_largo  CHECK (LENGTH(nombre_completo) <= 150),
    CONSTRAINT ck_usuario_correo_largo  CHECK (LENGTH(correo) <= 150)
);
COMMENT ON TABLE usuario IS 'RF-001, RNF-001/004: identidad local; credencial solo hash. DB-B11: longitudes CHECK son supuestos de diseño.';

CREATE TABLE rol (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    activo      BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_rol_nombre UNIQUE (nombre)
);
COMMENT ON TABLE rol IS 'RF-001, RN-08. Catálogo sembrado en V002: administrador, gestor, analista, consultor (decisión humana 07/10/2026, AR-B02).';

CREATE TABLE usuario_rol (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
    rol_id     BIGINT NOT NULL REFERENCES rol (id) ON DELETE RESTRICT,
    CONSTRAINT uq_usuario_rol UNIQUE (usuario_id, rol_id)  -- sin roles duplicados (decisiones §30)
);
-- usuario_id cubierto como prefijo del UNIQUE; índice para la otra dirección:
CREATE INDEX idx_usuario_rol_rol_id ON usuario_rol (rol_id);

-- ---------------------------------------------------------------------
-- 2. Catálogos (modelo lógico §2.4) — inactivación lógica, nunca DELETE (§12)
-- ---------------------------------------------------------------------

CREATE TABLE categoria (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    orden       BIGINT NOT NULL DEFAULT 0,   -- RNF-050 (presentación)
    activo      BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_categoria_nombre UNIQUE (nombre)
);
COMMENT ON TABLE categoria IS 'RF-011, RF-020, RN-01, RN-03.';

CREATE TABLE severidad (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    orden       BIGINT NOT NULL DEFAULT 0,
    activo      BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_severidad_nombre UNIQUE (nombre)
);
COMMENT ON TABLE severidad IS 'RF-021, RN-01, RN-03, RN-04.';

CREATE TABLE prioridad (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    orden       BIGINT NOT NULL DEFAULT 0,
    activo      BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_prioridad_nombre UNIQUE (nombre)
);
COMMENT ON TABLE prioridad IS 'RF-021, decisiones §6/§8.';

CREATE TABLE estado_incidente (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    orden       BIGINT NOT NULL DEFAULT 0,
    activo      BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_estado_incidente_nombre UNIQUE (nombre),
    -- CL-02 / RN-02 (autoridad, decisión 07/10/2026): catálogo cerrado de 5 estados.
    -- Renombrar un estado exige migración (no triggers, decisión §4).
    CONSTRAINT ck_estado_incidente_catalogo CHECK (
        nombre IN ('registrado', 'asignado', 'en investigación', 'resuelto', 'cerrado')
    )
);
COMMENT ON TABLE estado_incidente IS 'RF-031, RN-02, CL-02: 5 estados lineales con reapertura (decisión humana 07/10/2026, cierra DB-B05/DB-B10).';

CREATE TABLE tipo_incidente (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    categoria_id BIGINT NOT NULL REFERENCES categoria (id) ON DELETE RESTRICT,
    nombre       TEXT NOT NULL,
    descripcion  TEXT,
    orden        BIGINT NOT NULL DEFAULT 0,
    activo       BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT uq_tipo_incidente_nombre UNIQUE (nombre)
);
COMMENT ON TABLE tipo_incidente IS 'RF-020. Jerarquía categoría→tipo confirmada por la decisión de semillas V002 ("tipos por categoría", 07/10/2026).';
CREATE INDEX idx_tipo_incidente_categoria_id ON tipo_incidente (categoria_id);

-- ---------------------------------------------------------------------
-- 3. Incidentes (modelo lógico §2.5)
-- ---------------------------------------------------------------------

CREATE TABLE incidente (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo             TEXT NOT NULL,                       -- visible, ej. INC-000001 (§7)
    titulo             TEXT NOT NULL,
    descripcion        TEXT NOT NULL,
    categoria_id       BIGINT NOT NULL REFERENCES categoria (id) ON DELETE RESTRICT,
    tipo_id            BIGINT NOT NULL REFERENCES tipo_incidente (id) ON DELETE RESTRICT,
    severidad_id       BIGINT NOT NULL REFERENCES severidad (id) ON DELETE RESTRICT,
    prioridad_id       BIGINT NOT NULL REFERENCES prioridad (id) ON DELETE RESTRICT,
    estado_id          BIGINT NOT NULL REFERENCES estado_incidente (id) ON DELETE RESTRICT,
    reportante_id      BIGINT NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
    sistema_afectado   TEXT,                                -- texto libre (C-DB-08)
    fecha_registro     TIMESTAMPTZ NOT NULL DEFAULT now(),  -- RN-01 NOT NULL
    fecha_resolucion   TIMESTAMPTZ,
    fecha_cierre       TIMESTAMPTZ,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now(), -- RNF-021
    CONSTRAINT uq_incidente_codigo UNIQUE (codigo),
    CONSTRAINT ck_incidente_codigo_largo      CHECK (LENGTH(codigo) <= 20),
    CONSTRAINT ck_incidente_titulo_largo      CHECK (LENGTH(titulo) <= 200),
    CONSTRAINT ck_incidente_sistema_largo     CHECK (LENGTH(sistema_afectado) <= 150),
    CONSTRAINT ck_incidente_fechas_resolucion CHECK (
        fecha_resolucion IS NULL OR fecha_resolucion >= fecha_registro
    ),
    CONSTRAINT ck_incidente_fechas_cierre CHECK (
        fecha_cierre IS NULL OR fecha_resolucion IS NULL OR fecha_cierre >= fecha_resolucion
    )
);
COMMENT ON TABLE incidente IS 'RF-010/011. Sin columna responsable_id (informe_normalizacion §3); responsable vigente vía incidente_responsable (RN-01, decisión 07/10/2026). Sin DELETE: inactivación/regla de negocio (decisión §12/§23, CL-10).';

CREATE INDEX idx_incidente_categoria_id  ON incidente (categoria_id);   -- I-03 (FK)
CREATE INDEX idx_incidente_tipo_id       ON incidente (tipo_id);        -- I-03 (FK)
CREATE INDEX idx_incidente_severidad_id  ON incidente (severidad_id);   -- I-04 (FK)
CREATE INDEX idx_incidente_prioridad_id  ON incidente (prioridad_id);   -- I-02 (FK)
CREATE INDEX idx_incidente_reportante_id ON incidente (reportante_id);  -- FK (R2)
-- incidente.estado_id: sin índice simple — lo cubre idx_incidente_estado_fecha (V003, I-01, prefijo igualdad).

-- ---------------------------------------------------------------------
-- 4. Seguimiento (modelo lógico §2.6–§2.9)
-- ---------------------------------------------------------------------

CREATE TABLE incidente_responsable (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incidente_id        BIGINT NOT NULL REFERENCES incidente (id) ON DELETE RESTRICT,
    usuario_id          BIGINT NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
    fecha_asignacion    TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_desasignacion TIMESTAMPTZ,                         -- NULL = vigente (RN-04)
    asignado_por        BIGINT REFERENCES usuario (id) ON DELETE RESTRICT
);
COMMENT ON TABLE incidente_responsable IS 'RF-030, RN-01 (responsable obligatorio desde el registro — T-01, decisión 07/10/2026), RN-04, RF-031/RF-040.';

-- FK completo (todas las filas, no solo la vigente):
CREATE INDEX idx_incidente_responsable_incidente_id ON incidente_responsable (incidente_id);
CREATE INDEX idx_incidente_responsable_asignado_por ON incidente_responsable (asignado_por);
-- usuario_id: cubierto por I-05 (V003): (usuario_id, fecha_desasignacion).

-- CL-07 / I-06: como máximo UNA asignación vigente por incidente
-- (índice único parcial — patrón PostgreSQL; I-06 creado aquí por ser constraint).
CREATE UNIQUE INDEX uq_incidente_responsable_vigente
    ON incidente_responsable (incidente_id)
    WHERE fecha_desasignacion IS NULL;

CREATE TABLE accion_incidente (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incidente_id BIGINT NOT NULL REFERENCES incidente (id) ON DELETE RESTRICT,
    usuario_id   BIGINT NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
    fecha        TIMESTAMPTZ NOT NULL DEFAULT now(),        -- RN-05
    descripcion  TEXT NOT NULL,                             -- RN-05 / CL-04
    resultado    TEXT                                       -- RF-032, RN-06 (justifica cierre)
);
COMMENT ON TABLE accion_incidente IS 'RF-032, RN-05, RN-06: al menos una acción (o resultado) antes de cerrar.';
CREATE INDEX idx_accion_incidente_incidente_id ON accion_incidente (incidente_id);  -- I-07
-- usuario_id: índice DESCARTADO (indices_rendimiento.md §5: la consulta prevista
-- es por incidente, no por autor; crear solo cuando exista patrón de acceso).

CREATE TABLE comentario_incidente (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incidente_id BIGINT NOT NULL REFERENCES incidente (id) ON DELETE RESTRICT,
    usuario_id   BIGINT NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
    fecha        TIMESTAMPTZ NOT NULL DEFAULT now(),
    texto        TEXT NOT NULL                              -- RF-033
);
COMMENT ON TABLE comentario_incidente IS 'RF-033, RNF-023.';
CREATE INDEX idx_comentario_incidente_incidente_id ON comentario_incidente (incidente_id);  -- I-07
-- usuario_id: índice DESCARTADO (indices_rendimiento.md §5, igual que acción).

CREATE TABLE evidencia (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incidente_id    BIGINT NOT NULL REFERENCES incidente (id) ON DELETE RESTRICT,
    usuario_id      BIGINT NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
    nombre_archivo  TEXT NOT NULL,
    hash_integridad TEXT NOT NULL,                          -- SHA-256, 64 hex
    fecha_carga     TIMESTAMPTZ NOT NULL DEFAULT now(),     -- RN-09
    CONSTRAINT ck_evidencia_nombre_largo CHECK (LENGTH(nombre_archivo) <= 255),
    CONSTRAINT ck_evidencia_hash CHECK (hash_integridad ~ '^[0-9a-fA-F]{64}$')
);
COMMENT ON TABLE evidencia IS 'RF-012, RNF-006: alcance "metadatos + hash" (decisión humana 07/10/2026, cierra DB-B02/C-DB-01). El binario vive en volumen externo; nunca en esta tabla.';
CREATE INDEX idx_evidencia_incidente_id ON evidencia (incidente_id);  -- I-07
CREATE INDEX idx_evidencia_usuario_id   ON evidencia (usuario_id);

-- ---------------------------------------------------------------------
-- 5. Historial y auditoría append-only (modelo lógico §2.10–§2.11)
--    La inmutabilidad se impone por PERMISOS en V004 (sin triggers, decisión §4).
-- ---------------------------------------------------------------------

CREATE TABLE historial_incidente (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    incidente_id       BIGINT NOT NULL REFERENCES incidente (id) ON DELETE RESTRICT,
    estado_anterior_id BIGINT REFERENCES estado_incidente (id) ON DELETE RESTRICT,  -- NULL = primer registro
    estado_nuevo_id    BIGINT NOT NULL REFERENCES estado_incidente (id) ON DELETE RESTRICT,
    usuario_id         BIGINT NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
    fecha              TIMESTAMPTZ NOT NULL DEFAULT now(),
    observacion        TEXT
);
COMMENT ON TABLE historial_incidente IS 'RF-040, RN-07, RNF-021/023. Append-only (sin UPDATE/DELETE vía permisos, V004). Máquina de estados 07/10/2026: registrado→asignado→en investigación→resuelto→cerrado; reapertura cerrado→en investigación con acción justificativa (RN-10).';
CREATE INDEX idx_historial_incidente_estado_anterior_id ON historial_incidente (estado_anterior_id);
CREATE INDEX idx_historial_incidente_estado_nuevo_id    ON historial_incidente (estado_nuevo_id);
CREATE INDEX idx_historial_incidente_usuario_id         ON historial_incidente (usuario_id);
-- incidente_id: cubierto por I-08 (V003): (incidente_id, fecha).

CREATE TABLE auditoria (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id   BIGINT REFERENCES usuario (id) ON DELETE RESTRICT,   -- NULL = sistema
    incidente_id BIGINT REFERENCES incidente (id) ON DELETE RESTRICT, -- RNF-043
    fecha        TIMESTAMPTZ NOT NULL DEFAULT now(),
    operacion    TEXT NOT NULL,
    entidad      TEXT NOT NULL,
    registro_id  BIGINT,
    origen       TEXT                                                -- IP/sesión (§9: solo lo necesario)
);
COMMENT ON TABLE auditoria IS 'RF-070, RNF-022/040/041/043. Append-only; bitácora ≠ historial de dominio (Paso 10).';
CREATE INDEX idx_auditoria_incidente_id ON auditoria (incidente_id);
-- usuario_id y (entidad, registro_id): cubiertos por I-09 (V003).

-- =====================================================================
-- Fin de V001 (15 tablas). Índices de negocio: V003. Semillas: V002.
-- Siguiente en el orden: V002__semillas.sql
-- =====================================================================
