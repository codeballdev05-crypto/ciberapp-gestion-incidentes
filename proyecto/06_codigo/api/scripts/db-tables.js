// Lista las tablas existentes en la base de la aplicación (solo lectura).
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env'), quiet: true });
const { Client } = require('pg');

(async () => {
  const c = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  await c.connect();
  const r = await c.query(`SELECT table_schema, table_name FROM information_schema.tables
                           WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1,2`);
  console.log(r.rowCount ? r.rows.map((x) => `${x.table_schema}.${x.table_name}`).join('\n') : '(sin tablas)');
  await c.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
