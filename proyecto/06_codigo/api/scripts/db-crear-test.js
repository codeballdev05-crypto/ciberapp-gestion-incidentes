// Crea (si no existe) la base aislada de pruebas automáticas y la deja al día:
// migraciones V001..V00N + usuarios demo. Operación NO destructiva: nunca borra.
// Uso: npm run db:test-setup
const path = require('path');
const { execFileSync } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });
const { Client } = require('pg');

const BD_TEST = `${process.env.DB_NAME}_test`;

(async () => {
  const c = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: 'postgres',
  });
  await c.connect();
  const existe = (await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [BD_TEST])).rowCount;
  if (!existe) {
    await c.query(`CREATE DATABASE ${c.escapeIdentifier(BD_TEST)}`);
    console.log(`+ base ${BD_TEST} creada`);
  } else {
    console.log(`= base ${BD_TEST} ya existe`);
  }
  await c.end();

  const env = { ...process.env, DB_NAME: BD_TEST };
  for (const script of ['migrate.js', 'setup-entorno.js']) {
    process.stdout.write(execFileSync('node', [path.join(__dirname, script)], { env, encoding: 'utf8' }));
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
