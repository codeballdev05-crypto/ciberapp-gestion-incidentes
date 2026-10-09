// RF-001: administración de usuarios y roles. Inactivación lógica, nunca borrado.
const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { pool, transaccion } = require('../../db/pool');
const esquemas = require('../../utils/esquemas');
const { auditar } = require('../../utils/auditoria');
const { requierePermiso } = require('../../middleware/auth');
const { noEncontrado, conflicto } = require('../../utils/errores');

const router = Router();

const SELECT_USUARIO = `
  SELECT u.id, u.usuario, u.nombre_completo, u.correo, u.activo, u.fecha_alta, u.ultimo_acceso,
         COALESCE(array_agg(r.nombre ORDER BY r.nombre) FILTER (WHERE r.id IS NOT NULL), '{}') AS roles
  FROM usuario u
  LEFT JOIN usuario_rol ur ON ur.usuario_id = u.id
  LEFT JOIN rol r ON r.id = ur.rol_id`;

const filtros = z.object({
  rol: z.enum(['administrador', 'gestor', 'analista', 'consultor']).optional(),
  activo: z.enum(['true', 'false']).optional(),
});

async function asignarRoles(db, usuarioId, roles) {
  await db.query('DELETE FROM usuario_rol WHERE usuario_id = $1', [usuarioId]); // V007
  await db.query(
    'INSERT INTO usuario_rol (usuario_id, rol_id) SELECT $1, id FROM rol WHERE nombre = ANY($2::text[])',
    [usuarioId, roles]
  );
}

const obtener = async (db, id) => {
  const { rows } = await db.query(`${SELECT_USUARIO} WHERE u.id = $1 GROUP BY u.id`, [id]);
  if (!rows.length) throw noEncontrado('Usuario no encontrado');
  return rows[0];
};

// Gestor también lista: lo necesita para elegir responsables (RF-030).
router.get('/', requierePermiso('usuario:listar'), async (req, res) => {
  const f = filtros.parse(req.query);
  const params = [];
  const where = [];
  if (f.activo) { params.push(f.activo === 'true'); where.push(`u.activo = $${params.length}`); }
  let having = '';
  if (f.rol) { params.push(f.rol); having = `HAVING $${params.length} = ANY(array_agg(r.nombre))`; }
  const { rows } = await pool.query(
    `${SELECT_USUARIO} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} GROUP BY u.id ${having} ORDER BY u.nombre_completo`,
    params
  );
  res.json({ data: rows });
});

router.post('/', requierePermiso('usuario:administrar'), async (req, res) => {
  const d = esquemas.crearUsuario.parse(req.body);
  const hash = await bcrypt.hash(d.contrasena, 12); // RNF-004
  const usuario = await transaccion(async (db) => {
    const { rows } = await db.query(
      `INSERT INTO usuario (usuario, credencial_hash, nombre_completo, correo) VALUES ($1, $2, $3, $4) RETURNING id`,
      [d.usuario, hash, d.nombre_completo, d.correo || null]
    );
    await asignarRoles(db, rows[0].id, d.roles);
    await auditar(db, { usuarioId: req.usuario.id, operacion: 'CREAR_USUARIO', entidad: 'usuario', registroId: rows[0].id, origen: req.ip });
    return obtener(db, rows[0].id);
  });
  res.status(201).json({ data: usuario });
});

router.patch('/:id', requierePermiso('usuario:administrar'), async (req, res) => {
  const id = esquemas.id.parse(req.params.id);
  const d = esquemas.actualizarUsuario.parse(req.body);
  if (id === req.usuario.id && (d.activo === false || (d.roles && !d.roles.includes('administrador')))) {
    throw conflicto('AUTO_BLOQUEO', 'No puede desactivarse ni quitarse el rol de administrador a sí mismo');
  }
  const usuario = await transaccion(async (db) => {
    await obtener(db, id);
    const sets = [];
    const params = [id];
    const set = (col, val) => { params.push(val); sets.push(`${col} = $${params.length}`); };
    if (d.nombre_completo !== undefined) set('nombre_completo', d.nombre_completo);
    if (d.correo !== undefined) set('correo', d.correo || null);
    if (d.activo !== undefined) set('activo', d.activo);
    if (d.contrasena) set('credencial_hash', await bcrypt.hash(d.contrasena, 12));
    if (sets.length) await db.query(`UPDATE usuario SET ${sets.join(', ')} WHERE id = $1`, params);
    if (d.roles) await asignarRoles(db, id, d.roles);
    const operacion = d.activo === false ? 'DESACTIVAR_USUARIO' : 'ACTUALIZAR_USUARIO';
    await auditar(db, { usuarioId: req.usuario.id, operacion, entidad: 'usuario', registroId: id, origen: req.ip });
    return obtener(db, id);
  });
  res.json({ data: usuario });
});

module.exports = router;
