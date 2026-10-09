// Paso 19 — Pruebas sobre la base real: PK/FK/UNIQUE/CHECK, permisos, auditoría,
// transacciones y migraciones. Se ejecuta como el rol de la APLICACIÓN
// (app_incidentes) para probar mínimo privilegio. Todo ocurre dentro de una
// transacción que se revierte al final: no deja datos.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });
const { Client } = require('pg');

const OUT = path.resolve(__dirname, '../../../05_base_datos/14_pruebas/resultados_pruebas.md');
const base = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME };

const resultados = [];
function registrar(id, grupo, descripcion, trazabilidad, esperado, obtenido, ok) {
  resultados.push({ id, grupo, descripcion, trazabilidad, esperado, obtenido, ok });
  console.log(`${ok ? 'PASA' : 'FALLA'}  ${id} ${descripcion} → ${obtenido}`);
}

// Ejecuta sql dentro de un SAVEPOINT y espera un código SQLSTATE concreto (o éxito si esperado = 'OK').
async function caso(c, id, grupo, descripcion, trazabilidad, esperado, sql, params = []) {
  await c.query('SAVEPOINT caso');
  let obtenido;
  try {
    await c.query(sql, params);
    obtenido = 'OK';
  } catch (e) {
    obtenido = `${e.code} ${e.message.split('\n')[0].slice(0, 90)}`;
  }
  await c.query('ROLLBACK TO SAVEPOINT caso');
  // PG 12.2 con locale es_*: la traducción del mensaje de IDENTITY ALWAYS está rota
  // ("% s") y el servidor devuelve XX000 en lugar de 428C9. El INSERT sí se rechaza.
  const ok = obtenido.startsWith(esperado) ||
    (esperado === '428C9' && obtenido.startsWith('XX000') && obtenido.includes('columna'));
  registrar(id, grupo, descripcion, trazabilidad, esperado, obtenido, ok);
}

(async () => {
  // ---------------- Conexión como app_incidentes ----------------
  const app = new Client({ ...base, user: process.env.APP_DB_USER, password: process.env.APP_DB_PASSWORD });
  await app.connect();
  await app.query('BEGIN');

  const id = async (tabla, nombre) =>
    (await app.query(`SELECT id FROM ${tabla} WHERE nombre = $1`, [nombre])).rows[0].id;
  const usuarioId = (await app.query("SELECT id FROM usuario WHERE usuario = 'gestor'")).rows[0].id;
  const analistaId = (await app.query("SELECT id FROM usuario WHERE usuario = 'analista'")).rows[0].id;
  const catId = await id('categoria', 'malware');
  const tipoId = await id('tipo_incidente', 'ransomware');
  const sevId = await id('severidad', 'alta');
  const priId = await id('prioridad', 'alta');
  const estRegistrado = await id('estado_incidente', 'registrado');

  // Fixture: un incidente válido (se revierte al final)
  const inc = (await app.query(
    `INSERT INTO incidente (codigo, titulo, descripcion, categoria_id, tipo_id, severidad_id, prioridad_id, estado_id, reportante_id)
     VALUES ('INC-TEST-1', 'Prueba', 'Fixture de prueba', $1, $2, $3, $4, $5, $6) RETURNING id`,
    [catId, tipoId, sevId, priId, estRegistrado, usuarioId])).rows[0].id;
  await app.query('INSERT INTO incidente_responsable (incidente_id, usuario_id, asignado_por) VALUES ($1, $2, $3)', [inc, analistaId, usuarioId]);

  // ---------------- Integridad ----------------
  await caso(app, 'P-01', 'PK', 'IDENTITY ALWAYS rechaza id explícito', 'decisión identificadores', '428C9',
    "INSERT INTO categoria (id, nombre) VALUES (999, 'x')");
  await caso(app, 'P-02', 'FK', 'Incidente con categoría inexistente', 'RN-01, integridad.md', '23503',
    `INSERT INTO incidente (codigo, titulo, descripcion, categoria_id, tipo_id, severidad_id, prioridad_id, estado_id, reportante_id)
     VALUES ('INC-TEST-2','t','d', 999999, $1, $2, $3, $4, $5)`, [tipoId, sevId, priId, estRegistrado, usuarioId]);
  await caso(app, 'P-03', 'UNIQUE', 'Código de incidente duplicado', 'RF-010, decisiones §7', '23505',
    `INSERT INTO incidente (codigo, titulo, descripcion, categoria_id, tipo_id, severidad_id, prioridad_id, estado_id, reportante_id)
     VALUES ('INC-TEST-1','t','d', $1, $2, $3, $4, $5, $6)`, [catId, tipoId, sevId, priId, estRegistrado, usuarioId]);
  await caso(app, 'P-04', 'UNIQUE', 'Nombre de categoría duplicado', 'RF-020', '23505',
    "INSERT INTO categoria (nombre) VALUES ('malware')");
  await caso(app, 'P-05', 'NOT NULL', 'Incidente sin descripción', 'RN-01', '23502',
    `INSERT INTO incidente (codigo, titulo, descripcion, categoria_id, tipo_id, severidad_id, prioridad_id, estado_id, reportante_id)
     VALUES ('INC-TEST-3','t', NULL, $1, $2, $3, $4, $5, $6)`, [catId, tipoId, sevId, priId, estRegistrado, usuarioId]);
  await caso(app, 'P-06', 'CHECK', 'Estado fuera del catálogo cerrado de 5', 'RN-02, CL-02', '23514',
    "INSERT INTO estado_incidente (nombre) VALUES ('pendiente')");
  await caso(app, 'P-07', 'CHECK', 'Hash de evidencia no SHA-256', 'RF-012, RNF-006', '23514',
    'INSERT INTO evidencia (incidente_id, usuario_id, nombre_archivo, hash_integridad) VALUES ($1, $2, $3, $4)',
    [inc, analistaId, 'log.txt', 'abc123']);
  await caso(app, 'P-08', 'CHECK', 'Evidencia con SHA-256 válido', 'RF-012', 'OK',
    'INSERT INTO evidencia (incidente_id, usuario_id, nombre_archivo, hash_integridad) VALUES ($1, $2, $3, $4)',
    [inc, analistaId, 'log.txt', 'a'.repeat(64)]);
  await caso(app, 'P-09', 'CHECK', 'Fecha de resolución anterior al registro', 'integridad.md', '23514',
    "UPDATE incidente SET fecha_resolucion = fecha_registro - interval '1 day' WHERE id = $1", [inc]);
  await caso(app, 'P-10', 'UNIQUE parcial', 'Dos responsables vigentes en un incidente', 'RN-04, CL-07', '23505',
    'INSERT INTO incidente_responsable (incidente_id, usuario_id) VALUES ($1, $2)', [inc, usuarioId]);
  await caso(app, 'P-11', 'UNIQUE', 'Varios usuarios sin correo (NULL) permitidos', 'ajuste V001/PG12', 'OK',
    `INSERT INTO usuario (usuario, credencial_hash, nombre_completo) VALUES ('t1','h','T1'), ('t2','h','T2')`);

  // ---------------- Permisos (mínimo privilegio) ----------------
  await caso(app, 'P-12', 'Permisos', 'App no puede DELETE (inactivación lógica)', 'RN-07, decisiones §23', '42501',
    'DELETE FROM incidente WHERE id = $1', [inc]);
  await caso(app, 'P-13', 'Auditoría', 'App no puede UPDATE en auditoría (append-only)', 'RNF-022, RF-070', '42501',
    "UPDATE auditoria SET operacion = 'x'");
  await caso(app, 'P-14', 'Auditoría', 'App no puede UPDATE en historial (append-only)', 'RF-040, RN-07', '42501',
    "UPDATE historial_incidente SET observacion = 'x'");
  await caso(app, 'P-15', 'Auditoría', 'App sí puede INSERT en auditoría', 'RF-070', 'OK',
    "INSERT INTO auditoria (usuario_id, operacion, entidad, registro_id) VALUES ($1, 'PRUEBA', 'incidente', $2)", [usuarioId, inc]);
  await caso(app, 'P-16', 'Permisos', 'App no puede crear tablas (DDL)', 'decisiones §17', '42501',
    'CREATE TABLE intruso (id int)');
  await caso(app, 'P-17', 'Permisos', 'App no puede leer schema_migraciones', 'V005', '42501',
    'SELECT * FROM schema_migraciones');

  // ---------------- Transacciones (T-01: registro atómico) ----------------
  await app.query('SAVEPOINT tx');
  let atomico;
  try {
    const n = (await app.query(
      `INSERT INTO incidente (codigo, titulo, descripcion, categoria_id, tipo_id, severidad_id, prioridad_id, estado_id, reportante_id)
       VALUES ('INC-TEST-TX','t','d', $1, $2, $3, $4, $5, $6) RETURNING id`,
      [catId, tipoId, sevId, priId, estRegistrado, usuarioId])).rows[0].id;
    await app.query('INSERT INTO incidente_responsable (incidente_id, usuario_id) VALUES ($1, $2)', [n, analistaId]);
    await app.query('INSERT INTO historial_incidente (incidente_id, estado_nuevo_id, usuario_id) VALUES ($1, $2, $3)', [n, estRegistrado, usuarioId]);
    await app.query('INSERT INTO auditoria (usuario_id, operacion, entidad, registro_id) VALUES ($1, $2, $3, $4)', [usuarioId, 'CREAR', 'incidente', n]);
    await app.query('INSERT INTO incidente_responsable (incidente_id, usuario_id) VALUES ($1, $2)', [n, usuarioId]); // falla forzada (2º vigente)
    atomico = 'no falló';
  } catch (e) {
    await app.query('ROLLBACK TO SAVEPOINT tx');
    const quedan = (await app.query("SELECT count(*)::int AS n FROM incidente WHERE codigo = 'INC-TEST-TX'")).rows[0].n;
    atomico = quedan === 0 ? 'revertido: 0 filas de incidente/historial/auditoría' : `quedaron ${quedan} filas`;
  }
  registrar('P-18', 'Transacciones', 'Registro incidente+responsable+historial+auditoría es atómico', 'T-01, RN-01, RNF-022',
    'revertido', atomico, atomico.startsWith('revertido'));

  await app.query('ROLLBACK');
  await app.end();

  // ---------------- ON DELETE RESTRICT (requiere rol con DELETE: admin) ----------------
  const adm = new Client({ ...base, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  await adm.connect();
  await adm.query('BEGIN');
  await adm.query(`INSERT INTO incidente (codigo, titulo, descripcion, categoria_id, tipo_id, severidad_id, prioridad_id, estado_id, reportante_id)
                   VALUES ('INC-TEST-R','t','d', $1, $2, $3, $4, $5, $6)`, [catId, tipoId, sevId, priId, estRegistrado, usuarioId]);
  await caso(adm, 'P-19', 'FK', 'Borrar categoría con incidentes (ON DELETE RESTRICT)', 'decisión on_delete', '23503',
    'DELETE FROM categoria WHERE id = $1', [catId]);
  await adm.query('ROLLBACK');
  const residuos = (await adm.query("SELECT count(*)::int AS n FROM incidente WHERE codigo LIKE 'INC-TEST%'")).rows[0].n;
  await adm.end();
  registrar('P-20', 'Transacciones', 'Pruebas no dejan residuos en la BD', 'Paso 17: sin operaciones destructivas',
    '0 filas', `${residuos} filas`, residuos === 0);

  // ---------------- Migraciones: idempotencia y checksum ----------------
  const salida = execFileSync('node', [path.join(__dirname, 'migrate.js')], { encoding: 'utf8' });
  const todasYa = salida.trim().split('\n').every((l) => l.includes('ya aplicada'));
  registrar('P-21', 'Migraciones', 'Reejecutar migrate.js no reaplica versiones', 'DB-B08, versionamiento.md',
    'todas "ya aplicada"', todasYa ? 'todas "ya aplicada"' : salida.trim(), todasYa);

  // ---------------- Informe ----------------
  const ok = resultados.filter((r) => r.ok).length;
  const md = `# Resultados de pruebas de base de datos — Paso 19

- **Fecha:** ${new Date().toISOString().slice(0, 10)}
- **Ejecutado por:** \`proyecto/06_codigo/api/scripts/db-pruebas.js\` (reproducible: \`npm run db:test\`)
- **Contra:** base real \`${process.env.DB_NAME}\` (PostgreSQL 12.2), conectado como **\`${process.env.APP_DB_USER}\`** (rol de la aplicación).
  P-19/P-20 usan el rol administrativo porque la app no tiene DELETE.
- **Aislamiento:** todo dentro de transacciones revertidas (verificado en P-20).
- **Resultado:** **${ok}/${resultados.length} pruebas pasan.**

| ID | Grupo | Prueba | Trazabilidad | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|---|
${resultados.map((r) => `| ${r.id} | ${r.grupo} | ${r.descripcion} | ${r.trazabilidad} | \`${r.esperado}\` | ${r.obtenido.replace(/\|/g, '/')} | ${r.ok ? '✅' : '❌'} |`).join('\n')}

## Hallazgos detectados por estas pruebas (y corregidos)

| Prueba | Hallazgo | Corrección |
|---|---|---|
| P-16 | En PostgreSQL 12, \`PUBLIC\` tiene \`CREATE\` sobre el esquema \`public\`; el \`REVOKE\` de V004 sobre \`app_incidentes\` no lo anulaba y la aplicación **podía crear tablas**. | \`V006__revocar_create_public.sql\` (\`REVOKE CREATE ON SCHEMA public FROM PUBLIC\`). Reprobado: ✅ |
| P-01 | PG 12.2 con locale español tiene rota la traducción del error de IDENTITY ALWAYS y devuelve \`XX000\` (\`vsnprintf failed\`) en lugar de \`428C9\`. El INSERT **sí** se rechaza. | Bug del motor, no del esquema. La prueba acepta ambos códigos. La API nunca envía \`id\` explícito. Se recomienda actualizar a la última menor de PG 12 o a la versión del ADR. |
| (Paso 18) | ADR declara PostgreSQL 18.6; servidor real 12.2. \`UNIQUE NULLS NOT DISTINCT\` (PG15+) no existía. | V001 ajustado antes de aplicarse a \`UNIQUE\` estándar (además corrige que solo permitía un usuario sin correo — P-11). |

**Códigos SQLSTATE:** 23502 not_null · 23503 foreign_key · 23505 unique · 23514 check · 42501 privilegio insuficiente · 428C9 identity ALWAYS.

## Cobertura respecto del workflow (Paso 19)

| Exigido | Pruebas |
|---|---|
| PK | P-01 |
| FK | P-02, P-19 |
| UNIQUE | P-03, P-04, P-10, P-11 |
| CHECK / NOT NULL | P-05, P-06, P-07, P-08, P-09 |
| Auditoría (append-only) | P-13, P-14, P-15 |
| Permisos | P-12, P-16, P-17 |
| Transacciones | P-18, P-20 |
| Migraciones | P-21 |

## Fuera de alcance de estas pruebas
- Carga/concurrencia (T-11: 100 usuarios) y restauración de backup (T-12): se planifican para la fase de integración.
- Reglas de transición de estados (RN-02/RN-06/RN-10): por decisión de diseño viven en el backend, no en la BD; se prueban en la API.
`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md);
  console.log(`\n${ok}/${resultados.length} pruebas pasan → 14_pruebas/resultados_pruebas.md`);
  process.exit(ok === resultados.length ? 0 : 1);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
