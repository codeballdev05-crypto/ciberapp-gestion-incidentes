const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { pool } = require('../db/pool');
const { noAutenticado, prohibido } = require('../utils/errores');
const { puede } = require('./permisos');

const COOKIE = 'sesion';

// Cookie httpOnly + SameSite=Strict (skill auth-implementation-patterns: nunca JWT
// en localStorage). SameSite=Strict impide que otro sitio envíe la cookie (CSRF).
function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.produccion,
    path: '/api',
    maxAge: config.jwt.duracionMin * 60 * 1000,
  };
}

function emitirSesion(res, usuario) {
  const token = jwt.sign({ sub: String(usuario.id) }, config.jwt.secreto, {
    algorithm: 'HS256',
    expiresIn: `${config.jwt.duracionMin}m`,
  });
  res.cookie(COOKIE, token, opcionesCookie());
}

function cerrarSesion(res) {
  const { maxAge, ...opciones } = opcionesCookie();
  res.clearCookie(COOKIE, opciones);
}

async function cargarUsuario(id) {
  const r = await pool.query(
    `SELECT u.id, u.usuario, u.nombre_completo, u.correo, u.activo,
            COALESCE(array_agg(r.nombre ORDER BY r.nombre) FILTER (WHERE r.id IS NOT NULL), '{}') AS roles
     FROM usuario u
     LEFT JOIN usuario_rol ur ON ur.usuario_id = u.id
     LEFT JOIN rol r ON r.id = ur.rol_id AND r.activo
     WHERE u.id = $1
     GROUP BY u.id`,
    [id]
  );
  return r.rows[0];
}

// Verifica la sesión y recarga el usuario en cada petición: un usuario
// desactivado o con roles cambiados pierde el acceso de inmediato.
async function autenticar(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) throw noAutenticado();
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'] });
  } catch {
    cerrarSesion(res);
    throw noAutenticado();
  }
  const usuario = await cargarUsuario(Number(payload.sub));
  if (!usuario || !usuario.activo) {
    cerrarSesion(res);
    throw noAutenticado('Usuario inactivo o inexistente');
  }
  req.usuario = usuario;
  // Sesión deslizante.
  if (payload.exp * 1000 - Date.now() < config.jwt.renovarSiQuedanMin * 60 * 1000) emitirSesion(res, usuario);
  next();
}

const requierePermiso = (...permisos) => (req, _res, next) => {
  if (!permisos.some((p) => puede(req.usuario, p))) throw prohibido();
  next();
};

module.exports = { autenticar, requierePermiso, emitirSesion, cerrarSesion, cargarUsuario };
