// Paso 16/17 — Preparación del entorno local (idempotente).
//  1. Genera (si falta) la contraseña del rol de BD app_incidentes y la guarda SOLO en .env.
//  2. Genera (si falta) la contraseña de los usuarios demo y el secreto JWT, SOLO en .env.
//  3. Crea los usuarios demo (uno por rol) con hash bcrypt (RNF-004).
// Nada de esto se escribe en archivos versionados.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ENV_PATH = path.resolve(__dirname, '../../../../.env');
require('dotenv').config({ path: ENV_PATH, quiet: true });
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

function asegurarVariable(nombre, generar) {
  if (process.env[nombre]) return process.env[nombre];
  const valor = generar();
  fs.appendFileSync(ENV_PATH, `\n${nombre}=${valor}`);
  process.env[nombre] = valor;
  console.log(`+ ${nombre} generada y guardada en .env`);
  return valor;
}

const DEMO = [
  { usuario: 'admin',     nombre: 'Administrador Demo', rol: 'administrador' },
  { usuario: 'gestor',    nombre: 'Gestor Demo',        rol: 'gestor' },
  { usuario: 'analista',  nombre: 'Analista Demo',      rol: 'analista' },
  // Segundo analista: permite demostrar RN-08 (cada analista ve solo lo suyo) y la reasignación (RF-030).
  { usuario: 'analista2', nombre: 'Analista Dos Demo',  rol: 'analista' },
  { usuario: 'consultor', nombre: 'Consultor Demo',     rol: 'consultor' },
];

(async () => {
  // Los usuarios demo comparten una contraseña conocida: jamás en producción.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('setup-entorno crea usuarios demo y no se ejecuta con NODE_ENV=production');
  }
  asegurarVariable('APP_DB_USER', () => 'app_incidentes');
  const appPass = asegurarVariable('APP_DB_PASSWORD', () => crypto.randomBytes(18).toString('base64url'));
  asegurarVariable('JWT_SECRET', () => crypto.randomBytes(48).toString('base64url'));
  const demoPass = asegurarVariable('DEMO_PASSWORD', () => `Demo-${crypto.randomBytes(6).toString('hex')}`);

  const c = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  await c.connect();

  // ALTER ROLE no admite parámetros: se escapa con escapeLiteral.
  await c.query(`ALTER ROLE app_incidentes PASSWORD ${c.escapeLiteral(appPass)}`);
  console.log('= contraseña de app_incidentes sincronizada con .env');

  const hash = await bcrypt.hash(demoPass, 12);
  for (const u of DEMO) {
    await c.query('BEGIN');
    const r = await c.query(
      `INSERT INTO usuario (usuario, credencial_hash, nombre_completo, correo)
       VALUES ($1, $2, $3, $4) ON CONFLICT (usuario) DO NOTHING RETURNING id`,
      [u.usuario, hash, u.nombre, `${u.usuario}@demo.local`]);
    if (r.rowCount) {
      await c.query(
        `INSERT INTO usuario_rol (usuario_id, rol_id) SELECT $1, id FROM rol WHERE nombre = $2`,
        [r.rows[0].id, u.rol]);
      await c.query(
        `INSERT INTO auditoria (usuario_id, operacion, entidad, registro_id, origen)
         VALUES (NULL, 'ALTA_USUARIO_DEMO', 'usuario', $1, 'setup-entorno')`, [r.rows[0].id]);
      console.log(`+ usuario demo "${u.usuario}" (${u.rol})`);
    } else {
      console.log(`= usuario demo "${u.usuario}" ya existe`);
    }
    await c.query('COMMIT');
  }
  await c.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
