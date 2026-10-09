// Paso 16 — Conexión: verifica servidor y existencia de la base (solo lectura).
// Credenciales leídas exclusivamente desde .env (nunca versionadas).
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });
const { Client } = require('pg');

(async () => {
  const c = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });
  await c.connect();
  console.log((await c.query('SELECT version()')).rows[0].version);
  const r = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [process.env.DB_NAME]);
  console.log(`Base "${process.env.DB_NAME}":`, r.rowCount ? 'EXISTE' : 'NO EXISTE');
  await c.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
