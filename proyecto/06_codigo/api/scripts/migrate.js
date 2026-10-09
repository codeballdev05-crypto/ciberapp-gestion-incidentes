// Paso 17 — Despliegue: aplica proyecto/05_base_datos/13_sql/V*.sql en orden.
// Runner mínimo estilo Flyway (cierra DB-B08):
//   - cada versión se aplica en UNA transacción (todo o nada);
//   - se registra en schema_migraciones con checksum SHA-256;
//   - una versión ya aplicada no se reaplica; si su checksum cambió, se aborta (drift).
// No ejecuta DROP/TRUNCATE. Credenciales solo desde .env.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });
const { Client } = require('pg');

const SQL_DIR = path.resolve(__dirname, '../../../05_base_datos/13_sql');

(async () => {
  const c = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  await c.connect();

  await c.query(`CREATE TABLE IF NOT EXISTS schema_migraciones (
      version     TEXT PRIMARY KEY,
      archivo     TEXT NOT NULL,
      checksum    TEXT NOT NULL,
      aplicado_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const aplicadas = new Map(
    (await c.query('SELECT version, checksum FROM schema_migraciones')).rows.map((r) => [r.version, r.checksum])
  );

  const archivos = fs.readdirSync(SQL_DIR).filter((f) => /^V\d+__.+\.sql$/.test(f)).sort();
  for (const archivo of archivos) {
    const version = archivo.split('__')[0];
    const sql = fs.readFileSync(path.join(SQL_DIR, archivo), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    if (aplicadas.has(version)) {
      if (aplicadas.get(version) !== checksum) {
        throw new Error(`DRIFT: ${archivo} cambió después de aplicarse. Cree una nueva versión.`);
      }
      console.log(`= ${archivo} (ya aplicada)`);
      continue;
    }

    try {
      await c.query('BEGIN');
      await c.query(sql);
      await c.query('INSERT INTO schema_migraciones (version, archivo, checksum) VALUES ($1, $2, $3)',
        [version, archivo, checksum]);
      await c.query('COMMIT');
      console.log(`+ ${archivo} aplicada`);
    } catch (e) {
      await c.query('ROLLBACK');
      throw new Error(`${archivo}: ${e.message} (transacción revertida)`);
    }
  }
  await c.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
