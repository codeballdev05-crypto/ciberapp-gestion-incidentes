// Paso 18 — Verificación de base real (skill: database-documentation).
// Introspección del catálogo VIVO (fuente de verdad) → schema.json + ERD mermaid
// + diccionario de datos + diff contra el diseño (13_sql/V001) para detectar drift.
// Solo lectura. Contraseñas nunca se imprimen.
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });
const { Client } = require('pg');

const OUT_DIR = path.resolve(__dirname, '../../../05_base_datos/15_reportes');
const V001 = path.resolve(__dirname, '../../../05_base_datos/13_sql/V001__esquema_base.sql');

(async () => {
  const c = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  await c.connect();
  const q = async (sql, p) => (await c.query(sql, p)).rows;

  const version = (await q('SHOW server_version'))[0].server_version;
  const tablas = await q(`SELECT c.relname AS tabla, obj_description(c.oid) AS comentario
                          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                          WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1`);
  const columnas = await q(`SELECT table_name AS tabla, column_name AS columna, data_type AS tipo,
                                   is_nullable = 'YES' AS nulo, column_default AS defecto,
                                   is_identity = 'YES' AS identidad, ordinal_position AS pos
                            FROM information_schema.columns WHERE table_schema = 'public'
                            ORDER BY table_name, ordinal_position`);
  const constraints = await q(`SELECT conrelid::regclass::text AS tabla, conname AS nombre, contype AS tipo,
                                      pg_get_constraintdef(oid) AS definicion
                               FROM pg_constraint WHERE connamespace = 'public'::regnamespace
                               ORDER BY 1, 3, 2`);
  const indices = await q(`SELECT tablename AS tabla, indexname AS nombre, indexdef AS definicion
                           FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1, 2`);
  const fks = await q(`SELECT conrelid::regclass::text AS origen, confrelid::regclass::text AS destino,
                              a.attname AS columna, confdeltype AS on_delete
                       FROM pg_constraint co
                       JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = co.conkey[1]
                       WHERE co.contype = 'f' AND co.connamespace = 'public'::regnamespace ORDER BY 1, 3`);
  const permisos = await q(`SELECT grantee, table_name AS tabla, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privilegios
                            FROM information_schema.role_table_grants
                            WHERE table_schema = 'public' AND grantee IN ('app_incidentes','migrate_incidentes','admin_incidentes')
                            GROUP BY 1, 2 ORDER BY 1, 2`);
  const conteos = {};
  for (const t of tablas) conteos[t.tabla] = Number((await q(`SELECT count(*) FROM ${c.escapeIdentifier(t.tabla)}`))[0].count);
  const migraciones = await q('SELECT version, archivo, left(checksum, 12) AS checksum, aplicado_en FROM schema_migraciones ORDER BY version');
  await c.end();

  // La carpeta de reportes puede no existir (p. ej., en un clon que solo trae el código).
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ---- schema.json (artefacto legible por máquina) ----
  const schema = { motor: 'PostgreSQL', version, generado: new Date().toISOString(), tablas, columnas, constraints, indices, fks, permisos, conteos, migraciones };
  fs.writeFileSync(path.join(OUT_DIR, 'schema.json'), JSON.stringify(schema, null, 2));

  // ---- Diff diseño (V001) vs real ----
  const v001 = fs.readFileSync(V001, 'utf8');
  const diseñoTablas = [...v001.matchAll(/CREATE TABLE (\w+)/g)].map((m) => m[1]).sort();
  const diseñoIdx = [...fs.readdirSync(path.dirname(V001)).filter((f) => f.endsWith('.sql'))
    .flatMap((f) => [...fs.readFileSync(path.join(path.dirname(V001), f), 'utf8').replace(/--.*$/gm, '').matchAll(/CREATE (?:UNIQUE )?INDEX (\w+)/g)].map((m) => m[1]))].sort();
  const realTablas = tablas.map((t) => t.tabla).filter((t) => t !== 'schema_migraciones');
  const realIdx = indices.map((i) => i.nombre).filter((n) => !n.endsWith('_pkey') && !constraints.some((k) => k.nombre === n));
  const faltan = (a, b) => a.filter((x) => !b.includes(x));
  const drift = {
    tablasSoloDiseño: faltan(diseñoTablas, realTablas), tablasSoloReal: faltan(realTablas, diseñoTablas),
    indicesSoloDiseño: faltan(diseñoIdx, realIdx), indicesSoloReal: faltan(realIdx, diseñoIdx),
  };

  // ---- ERD mermaid desde FKs reales ----
  const tipoMermaid = (t) => t.replace(/ with(out)? time zone/, '').replace(/\s+/g, '_');
  let erd = 'erDiagram\n';
  for (const t of tablas) {
    erd += `  ${t.tabla} {\n`;
    for (const col of columnas.filter((x) => x.tabla === t.tabla)) {
      const pk = constraints.some((k) => k.tabla === t.tabla && k.tipo === 'p' && k.definicion.includes(`(${col.columna})`));
      const fk = fks.some((f) => f.origen === t.tabla && f.columna === col.columna);
      erd += `    ${tipoMermaid(col.tipo)} ${col.columna}${pk ? ' PK' : fk ? ' FK' : ''}\n`;
    }
    erd += '  }\n';
  }
  for (const f of fks) erd += `  ${f.destino} ||--o{ ${f.origen} : "${f.columna}"\n`;

  const ON_DELETE = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };
  const TIPO_K = { p: 'PK', f: 'FK', u: 'UNIQUE', c: 'CHECK' };

  // ---- Markdown ----
  let md = `# Documentación de la base real — Paso 18

- **Skill:** \`database-documentation\` (introspección del catálogo vivo como fuente de verdad)
- **Generado por:** \`proyecto/06_codigo/api/scripts/db-documentar.js\` (reproducible: \`npm run db:docs\`)
- **Fecha:** ${new Date().toISOString().slice(0, 10)}
- **Nivel de acceso alcanzado:** conexión directa al servidor vivo (driver \`pg\`, credenciales desde \`.env\`, no impresas)
- **Motor real:** PostgreSQL **${version}** · base \`${process.env.DB_NAME}\` · esquema \`public\`

> ⚠ **Drift de versión:** el ADR y \`seleccion_dbms.md\` declaran PostgreSQL 18.6; el servidor real es **${version}**.
> Impacto: \`UNIQUE NULLS NOT DISTINCT\` (PG15+) se sustituyó por \`UNIQUE\` estándar en V001 antes de aplicarlo.
> El resto del esquema (IDENTITY, TIMESTAMPTZ, índices parciales, CHECK con regex) es compatible con PG ≥ 12.

## 1. Inventario (conteos vivos)

| Objeto | Cantidad |
|---|---|
| Tablas (incl. \`schema_migraciones\`) | ${tablas.length} |
| Columnas | ${columnas.length} |
| Primary keys | ${constraints.filter((k) => k.tipo === 'p').length} |
| Foreign keys | ${constraints.filter((k) => k.tipo === 'f').length} |
| UNIQUE | ${constraints.filter((k) => k.tipo === 'u').length} |
| CHECK | ${constraints.filter((k) => k.tipo === 'c').length} |
| Índices (todos) | ${indices.length} |
| Migraciones aplicadas | ${migraciones.length} |

## 2. Migraciones aplicadas

| Versión | Archivo | Checksum (SHA-256, 12) | Aplicada |
|---|---|---|---|
${migraciones.map((m) => `| ${m.version} | \`${m.archivo}\` | \`${m.checksum}\` | ${new Date(m.aplicado_en).toISOString().slice(0, 19).replace('T', ' ')} |`).join('\n')}

## 3. Diagrama E-R (obtenido de la base real)

\`\`\`mermaid
${erd}\`\`\`

## 4. Diccionario de datos

${tablas.map((t) => `### \`${t.tabla}\` — ${conteos[t.tabla]} fila(s)
${t.comentario ? `> ${t.comentario}\n` : ''}
| Columna | Tipo | Nulo | Default |
|---|---|---|---|
${columnas.filter((x) => x.tabla === t.tabla).map((x) => `| \`${x.columna}\` | ${x.tipo} | ${x.nulo ? 'sí' : 'no'} | ${x.identidad ? 'IDENTITY' : x.defecto ? `\`${x.defecto}\`` : ''} |`).join('\n')}

**Constraints:** ${constraints.filter((k) => k.tabla === t.tabla).map((k) => `${TIPO_K[k.tipo] || k.tipo} \`${k.nombre}\``).join(' · ') || '—'}

**FK:** ${fks.filter((f) => f.origen === t.tabla).map((f) => `\`${f.columna}\` → \`${f.destino}\` (ON DELETE ${ON_DELETE[f.on_delete]})`).join(' · ') || '—'}

**Índices:** ${indices.filter((i) => i.tabla === t.tabla).map((i) => `\`${i.nombre}\``).join(' · ')}
`).join('\n')}
## 5. Permisos reales por rol de BD

| Rol | Tabla | Privilegios |
|---|---|---|
${permisos.map((p) => `| \`${p.grantee}\` | \`${p.tabla}\` | ${p.privilegios} |`).join('\n')}

## 6. Comparación diseño vs esquema real (detección de drift)

| Verificación | Resultado |
|---|---|
| Tablas en V001 que no existen en la BD | ${drift.tablasSoloDiseño.length ? drift.tablasSoloDiseño.join(', ') : '✅ ninguna'} |
| Tablas en la BD que no están en V001 | ${drift.tablasSoloReal.length ? drift.tablasSoloReal.join(', ') : '✅ ninguna'} (\`schema_migraciones\` excluida: tabla de control del runner) |
| Índices declarados en 13_sql que no existen | ${drift.indicesSoloDiseño.length ? drift.indicesSoloDiseño.join(', ') : '✅ ninguno'} |
| Índices en la BD no declarados en 13_sql | ${drift.indicesSoloReal.length ? drift.indicesSoloReal.join(', ') : '✅ ninguno'} |
| Todas las FK con ON DELETE RESTRICT (decisión §on_delete) | ${fks.every((f) => f.on_delete === 'r') ? `✅ ${fks.length}/${fks.length}` : '❌ ' + fks.filter((f) => f.on_delete !== 'r').map((f) => f.origen + '.' + f.columna).join(', ')} |
| Ninguna columna de contraseña en texto plano | ${columnas.some((x) => /password|contrasena|clave/.test(x.columna)) ? '❌ revisar' : '✅ solo `usuario.credencial_hash`'} |

**Resultado del diff:** ${Object.values(drift).every((a) => a.length === 0) ? '**vacío** — el esquema real coincide con el diseño versionado.' : '**con diferencias** — ver tabla.'}
`;
  fs.writeFileSync(path.join(OUT_DIR, 'documentacion_real.md'), md);
  console.log('Generado: 15_reportes/documentacion_real.md y schema.json');
  console.log('Drift:', JSON.stringify(drift));
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
