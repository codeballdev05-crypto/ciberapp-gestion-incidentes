// RF-001 / RNF-001: autenticación. login, logout y me.
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { pool, transaccion } = require('../../db/pool');
const esquemas = require('../../utils/esquemas');
const { auditar } = require('../../utils/auditoria');
const { ErrorApp } = require('../../utils/errores');
const { autenticar, emitirSesion, cerrarSesion, cargarUsuario } = require('../../middleware/auth');
const { PERMISOS, puede } = require('../../middleware/permisos');

const router = Router();

// Hash ficticio: se compara aunque el usuario no exista, para que el tiempo de
// respuesta no revele qué usuarios existen (enumeración de cuentas).
const HASH_FICTICIO = bcrypt.hashSync('no-existe', 12);

// Fuerza bruta: 10 intentos por IP cada 15 minutos (skill auth-implementation-patterns).
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 10),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ error: { codigo: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos. Espere 15 minutos.' } }),
});

const conPermisos = (u) => ({
  ...u,
  permisos: Object.keys(PERMISOS).filter((p) => puede(u, p)),
});

router.post('/login', limiteLogin, async (req, res) => {
  const { usuario, contrasena } = esquemas.login.parse(req.body);
  const r = await pool.query('SELECT id, credencial_hash, activo FROM usuario WHERE usuario = $1', [usuario]);
  const fila = r.rows[0];
  const valida = await bcrypt.compare(contrasena, fila?.credencial_hash || HASH_FICTICIO);

  if (!fila || !valida || !fila.activo) {
    // Evento de seguridad (RNF-040): se audita el intento fallido sin revelar el motivo.
    await auditar(pool, { usuarioId: fila?.id ?? null, operacion: 'LOGIN_FALLIDO', entidad: 'sesion', origen: req.ip });
    throw new ErrorApp(401, 'CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos');
  }

  await transaccion(async (db) => {
    await db.query('UPDATE usuario SET ultimo_acceso = now() WHERE id = $1', [fila.id]);
    await auditar(db, { usuarioId: fila.id, operacion: 'LOGIN', entidad: 'sesion', origen: req.ip });
  });
  const u = await cargarUsuario(fila.id);
  emitirSesion(res, u);
  res.json({ data: conPermisos(u) });
});

router.post('/logout', autenticar, async (req, res) => {
  await auditar(pool, { usuarioId: req.usuario.id, operacion: 'LOGOUT', entidad: 'sesion', origen: req.ip });
  cerrarSesion(res);
  res.status(204).end();
});

router.get('/me', autenticar, (req, res) => {
  res.json({ data: conPermisos(req.usuario) });
});

module.exports = router;
