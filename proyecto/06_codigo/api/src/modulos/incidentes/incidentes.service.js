// Lógica de dominio de incidentes. Cada operación de escritura:
//   1. bloquea la fila (SELECT … FOR UPDATE) y valida la versión (DB-B12, optimistic locking);
//   2. aplica reglas de negocio (RN-01…RN-10);
//   3. escribe cambio + historial + auditoría en UNA transacción (RNF-022, T-01).
const crypto = require('crypto');
const { pool, transaccion } = require('../../db/pool');
const { auditar } = require('../../utils/auditoria');
const { noEncontrado, conflicto, reglaNegocio, prohibido } = require('../../utils/errores');
const { puede } = require('../../middleware/permisos');
const maquina = require('./maquina-estados');

// Versión = marca de última actualización en microsegundos (control de concurrencia optimista).
const VERSION = '(extract(epoch FROM i.fecha_actualizacion) * 1000000)::bigint::text';

const SELECT_INCIDENTE = `
  SELECT i.id, i.codigo, i.titulo, i.descripcion, i.sistema_afectado,
         i.fecha_registro, i.fecha_resolucion, i.fecha_cierre, i.fecha_actualizacion,
         ${VERSION} AS version,
         json_build_object('id', c.id, 'nombre', c.nombre) AS categoria,
         json_build_object('id', t.id, 'nombre', t.nombre) AS tipo,
         json_build_object('id', s.id, 'nombre', s.nombre, 'orden', s.orden) AS severidad,
         json_build_object('id', p.id, 'nombre', p.nombre, 'orden', p.orden) AS prioridad,
         json_build_object('id', e.id, 'nombre', e.nombre, 'orden', e.orden) AS estado,
         json_build_object('id', rep.id, 'usuario', rep.usuario, 'nombre_completo', rep.nombre_completo) AS reportante,
         CASE WHEN res.id IS NULL THEN NULL ELSE
           json_build_object('id', res.id, 'usuario', res.usuario, 'nombre_completo', res.nombre_completo,
                             'desde', ir.fecha_asignacion) END AS responsable
  FROM incidente i
  JOIN categoria c        ON c.id = i.categoria_id
  JOIN tipo_incidente t   ON t.id = i.tipo_id
  JOIN severidad s        ON s.id = i.severidad_id
  JOIN prioridad p        ON p.id = i.prioridad_id
  JOIN estado_incidente e ON e.id = i.estado_id
  JOIN usuario rep        ON rep.id = i.reportante_id
  LEFT JOIN incidente_responsable ir ON ir.incidente_id = i.id AND ir.fecha_desasignacion IS NULL
  LEFT JOIN usuario res   ON res.id = ir.usuario_id`;

// ---------------------------------------------------------------- consultas

// RF-041: búsqueda y filtrado. El analista solo ve sus incidentes (RN-08).
async function listar(filtros, usuario) {
  const where = [];
  const params = [];
  const agregar = (sql, valor) => { params.push(valor); where.push(sql.replace('?', `$${params.length}`)); };

  if (filtros.estado) agregar('i.estado_id = ?', filtros.estado);
  if (filtros.severidad) agregar('i.severidad_id = ?', filtros.severidad);
  if (filtros.prioridad) agregar('i.prioridad_id = ?', filtros.prioridad);
  if (filtros.categoria) agregar('i.categoria_id = ?', filtros.categoria);
  if (filtros.tipo) agregar('i.tipo_id = ?', filtros.tipo);
  if (filtros.desde) agregar('i.fecha_registro >= ?', filtros.desde);
  if (filtros.hasta) agregar('i.fecha_registro <= ?', filtros.hasta);
  if (filtros.q) agregar("(i.codigo ILIKE ? OR i.titulo ILIKE $X OR i.sistema_afectado ILIKE $X)".replace(/\$X/g, `$${params.length + 1}`), `%${filtros.q.replace(/[\\%_]/g, '\\$&')}%`);

  if (!puede(usuario, 'incidente:leer_todos')) agregar('ir.usuario_id = ?', usuario.id);
  else if (filtros.responsable) agregar('ir.usuario_id = ?', filtros.responsable);

  params.push(filtros.por_pagina, (filtros.pagina - 1) * filtros.por_pagina);
  const sql = `${SELECT_INCIDENTE.replace('SELECT i.id', 'SELECT count(*) OVER() AS total_filas, i.id')}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY i.fecha_registro DESC, i.id DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const { rows } = await pool.query(sql, params);
  const total = rows[0]?.total_filas ?? 0;
  return {
    data: rows.map(({ total_filas, descripcion, ...r }) => r),
    meta: { pagina: filtros.pagina, por_pagina: filtros.por_pagina, total, paginas: Math.ceil(total / filtros.por_pagina) },
  };
}

async function verificarAcceso(db, id, usuario) {
  if (puede(usuario, 'incidente:leer_todos')) return;
  const r = await db.query(
    'SELECT 1 FROM incidente_responsable WHERE incidente_id = $1 AND usuario_id = $2 AND fecha_desasignacion IS NULL',
    [id, usuario.id]
  );
  // 404 (no 403): no se revela la existencia de incidentes ajenos.
  if (!r.rowCount) throw noEncontrado('Incidente no encontrado');
}

// RF-040: detalle + historial + acciones + comentarios + evidencias.
async function obtenerDetalle(db, id) {
  const { rows } = await db.query(`${SELECT_INCIDENTE} WHERE i.id = $1`, [id]);
  if (!rows.length) throw noEncontrado('Incidente no encontrado');
  // Secuencial: `db` puede ser el cliente de una transacción, que no admite consultas concurrentes.
  const consultas = [
    () => db.query(`SELECT h.id, h.fecha, h.observacion, ea.nombre AS estado_anterior, en.nombre AS estado_nuevo,
                     json_build_object('id', u.id, 'nombre_completo', u.nombre_completo) AS usuario
              FROM historial_incidente h
              LEFT JOIN estado_incidente ea ON ea.id = h.estado_anterior_id
              JOIN estado_incidente en ON en.id = h.estado_nuevo_id
              JOIN usuario u ON u.id = h.usuario_id
              WHERE h.incidente_id = $1 ORDER BY h.fecha, h.id`, [id]),
    () => db.query(`SELECT a.id, a.fecha, a.descripcion, a.resultado,
                     json_build_object('id', u.id, 'nombre_completo', u.nombre_completo) AS usuario
              FROM accion_incidente a JOIN usuario u ON u.id = a.usuario_id
              WHERE a.incidente_id = $1 ORDER BY a.fecha, a.id`, [id]),
    () => db.query(`SELECT c.id, c.fecha, c.texto,
                     json_build_object('id', u.id, 'nombre_completo', u.nombre_completo) AS usuario
              FROM comentario_incidente c JOIN usuario u ON u.id = c.usuario_id
              WHERE c.incidente_id = $1 ORDER BY c.fecha, c.id`, [id]),
    () => db.query(`SELECT ev.id, ev.nombre_archivo, ev.hash_integridad, ev.fecha_carga,
                     json_build_object('id', u.id, 'nombre_completo', u.nombre_completo) AS usuario
              FROM evidencia ev JOIN usuario u ON u.id = ev.usuario_id
              WHERE ev.incidente_id = $1 ORDER BY ev.fecha_carga, ev.id`, [id]),
    () => db.query(`SELECT ir.fecha_asignacion, ir.fecha_desasignacion,
                     json_build_object('id', u.id, 'nombre_completo', u.nombre_completo) AS usuario
              FROM incidente_responsable ir JOIN usuario u ON u.id = ir.usuario_id
              WHERE ir.incidente_id = $1 ORDER BY ir.fecha_asignacion, ir.id`, [id]),
  ];
  const res = [];
  for (const consulta of consultas) res.push(await consulta());
  const [historial, acciones, comentarios, evidencias, responsables] = res;
  return {
    ...rows[0],
    transiciones_permitidas: maquina.TRANSICIONES[rows[0].estado.nombre],
    historial: historial.rows,
    acciones: acciones.rows,
    comentarios: comentarios.rows,
    evidencias: evidencias.rows,
    responsables: responsables.rows,
  };
}

async function obtener(id, usuario) {
  await verificarAcceso(pool, id, usuario);
  return obtenerDetalle(pool, id);
}

// ---------------------------------------------------------------- validaciones de dominio

async function validarClasificacion(db, d) {
  const { rows } = await db.query(
    `SELECT (SELECT nombre FROM categoria WHERE id = $1 AND activo) AS categoria,
            (SELECT categoria_id FROM tipo_incidente WHERE id = $2 AND activo) AS tipo_categoria_id,
            (SELECT nombre FROM tipo_incidente WHERE id = $2) AS tipo,
            (SELECT nombre FROM severidad WHERE id = $3 AND activo) AS severidad,
            (SELECT nombre FROM prioridad WHERE id = $4 AND activo) AS prioridad`,
    [d.categoria_id, d.tipo_id, d.severidad_id, d.prioridad_id]
  );
  const n = rows[0];
  if (!n.categoria) throw reglaNegocio('CATEGORIA_INVALIDA', 'La categoría no existe o está inactiva');
  if (!n.tipo_categoria_id) throw reglaNegocio('TIPO_INVALIDO', 'El tipo no existe o está inactivo');
  if (n.tipo_categoria_id !== d.categoria_id) {
    throw reglaNegocio('TIPO_NO_PERTENECE', `El tipo "${n.tipo}" no pertenece a la categoría "${n.categoria}" (RF-020)`);
  }
  if (!n.severidad) throw reglaNegocio('SEVERIDAD_INVALIDA', 'La severidad no existe o está inactiva');
  if (!n.prioridad) throw reglaNegocio('PRIORIDAD_INVALIDA', 'La prioridad no existe o está inactiva');
  // RN-04: severidad crítica ⇒ atención prioritaria.
  if (n.severidad === 'crítica' && n.prioridad !== 'alta') {
    throw reglaNegocio('RN04_CRITICO_PRIORIDAD', 'Un incidente de severidad crítica debe tener prioridad alta (RN-04)');
  }
  return n;
}

async function validarResponsable(db, usuarioId) {
  const { rows } = await db.query(
    `SELECT u.nombre_completo FROM usuario u
     JOIN usuario_rol ur ON ur.usuario_id = u.id
     JOIN rol r ON r.id = ur.rol_id AND r.activo
     WHERE u.id = $1 AND u.activo AND r.nombre IN ('analista', 'gestor', 'administrador')
     LIMIT 1`,
    [usuarioId]
  );
  if (!rows.length) {
    throw reglaNegocio('RESPONSABLE_INVALIDO', 'El responsable debe ser un usuario activo con rol analista, gestor o administrador');
  }
  return rows[0].nombre_completo;
}

const idEstado = async (db, nombre) =>
  (await db.query('SELECT id FROM estado_incidente WHERE nombre = $1', [nombre])).rows[0].id;

// Bloquea la fila para la transacción y valida acceso y versión.
async function bloquear(db, id, usuario, version) {
  await verificarAcceso(db, id, usuario);
  const { rows } = await db.query(
    `SELECT i.*, ${VERSION} AS version, e.nombre AS estado,
            c.nombre AS categoria, t.nombre AS tipo, s.nombre AS severidad, p.nombre AS prioridad
     FROM incidente i
     JOIN estado_incidente e ON e.id = i.estado_id
     JOIN categoria c ON c.id = i.categoria_id
     JOIN tipo_incidente t ON t.id = i.tipo_id
     JOIN severidad s ON s.id = i.severidad_id
     JOIN prioridad p ON p.id = i.prioridad_id
     WHERE i.id = $1 FOR UPDATE OF i`,
    [id]
  );
  if (!rows.length) throw noEncontrado('Incidente no encontrado');
  if (version !== undefined && rows[0].version !== version) {
    throw conflicto('VERSION_DESACTUALIZADA', 'El incidente fue modificado por otro usuario. Recargue y vuelva a intentar.');
  }
  return rows[0];
}

const tocar = (db, id) => db.query('UPDATE incidente SET fecha_actualizacion = now() WHERE id = $1', [id]);

async function historial(db, { incidenteId, anteriorId, nuevoId, usuarioId, observacion }) {
  await db.query(
    `INSERT INTO historial_incidente (incidente_id, estado_anterior_id, estado_nuevo_id, usuario_id, observacion)
     VALUES ($1, $2, $3, $4, $5)`,
    [incidenteId, anteriorId, nuevoId, usuarioId, observacion]
  );
}

const noCerrado = (inc) => {
  if (inc.estado === 'cerrado') {
    throw conflicto('INCIDENTE_CERRADO', 'Un incidente cerrado no puede modificarse; regístrelo como acción o reabra el incidente (RN-10)');
  }
};

// ---------------------------------------------------------------- comandos

// RF-010 / RF-011 / RN-01: registro con responsable obligatorio, en una transacción.
async function crear(d, usuario, origen) {
  return transaccion(async (db) => {
    await validarClasificacion(db, d);
    const nombreResp = await validarResponsable(db, d.responsable_id);
    const estado = await idEstado(db, 'registrado');

    // El código visible deriva del id (INC-000001). Se inserta un marcador único y
    // se actualiza en la misma transacción: el rol de la app no usa secuencias.
    const temporal = `TMP-${crypto.randomBytes(8).toString('hex')}`;
    const { rows } = await db.query(
      `INSERT INTO incidente (codigo, titulo, descripcion, categoria_id, tipo_id, severidad_id, prioridad_id,
                              estado_id, reportante_id, sistema_afectado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [temporal, d.titulo, d.descripcion, d.categoria_id, d.tipo_id, d.severidad_id, d.prioridad_id,
        estado, usuario.id, d.sistema_afectado || null]
    );
    const id = rows[0].id;
    await db.query('UPDATE incidente SET codigo = $1 WHERE id = $2', [`INC-${String(id).padStart(6, '0')}`, id]);
    await db.query(
      'INSERT INTO incidente_responsable (incidente_id, usuario_id, asignado_por) VALUES ($1, $2, $3)',
      [id, d.responsable_id, usuario.id]
    );
    await historial(db, {
      incidenteId: id, anteriorId: null, nuevoId: estado, usuarioId: usuario.id,
      observacion: `Registro del incidente. Responsable: ${nombreResp}`,
    });
    await auditar(db, { usuarioId: usuario.id, incidenteId: id, operacion: 'CREAR', entidad: 'incidente', registroId: id, origen });
    return obtenerDetalle(db, id);
  });
}

// RF-011 / RF-020 / RF-021: edición de datos y clasificación (no del estado).
async function actualizar(id, d, usuario, origen) {
  return transaccion(async (db) => {
    const inc = await bloquear(db, id, usuario, d.version);
    noCerrado(inc);
    if (d.sistema_afectado !== undefined) d.sistema_afectado = d.sistema_afectado || null;
    const campos = ['titulo', 'descripcion', 'categoria_id', 'tipo_id', 'severidad_id', 'prioridad_id', 'sistema_afectado'];
    const cambios = campos.filter((c) => d[c] !== undefined && d[c] !== inc[c]);
    if (!cambios.length) return obtenerDetalle(db, id);

    const nuevo = { ...inc, ...Object.fromEntries(cambios.map((c) => [c, d[c]])) };
    const nombres = await validarClasificacion(db, nuevo);

    const sets = cambios.map((c, i) => `${c} = $${i + 2}`);
    await db.query(
      `UPDATE incidente SET ${sets.join(', ')}, fecha_actualizacion = now() WHERE id = $1`,
      [id, ...cambios.map((c) => nuevo[c])]
    );

    // RN-07: el cambio relevante queda en el historial con valores anterior → nuevo.
    const etiqueta = { categoria_id: 'categoria', tipo_id: 'tipo', severidad_id: 'severidad', prioridad_id: 'prioridad' };
    const detalle = cambios.map((c) =>
      etiqueta[c] ? `${etiqueta[c]}: ${inc[etiqueta[c]]} → ${nombres[etiqueta[c]]}` : c.replace('_', ' ')
    );
    await historial(db, {
      incidenteId: id, anteriorId: inc.estado_id, nuevoId: inc.estado_id, usuarioId: usuario.id,
      observacion: `Datos modificados — ${detalle.join('; ')}`,
    });
    await auditar(db, { usuarioId: usuario.id, incidenteId: id, operacion: 'ACTUALIZAR', entidad: 'incidente', registroId: id, origen });
    return obtenerDetalle(db, id);
  });
}

// RF-031 / RF-050 / RN-02 / RN-06 / RN-10: transición de estado controlada.
async function cambiarEstado(id, d, usuario, origen) {
  return transaccion(async (db) => {
    const inc = await bloquear(db, id, usuario, d.version);
    const desde = inc.estado;
    const hacia = d.estado;

    if (!maquina.esValida(desde, hacia)) {
      const permitidos = maquina.TRANSICIONES[desde].join(', ') || 'ninguno';
      throw conflicto('TRANSICION_INVALIDA', `No se puede pasar de "${desde}" a "${hacia}". Permitido: ${permitidos} (RN-02)`);
    }
    if (!puede(usuario, maquina.permisoTransicion(desde, hacia))) {
      throw prohibido(`Su rol no puede ${hacia === 'cerrado' ? 'cerrar' : 'reabrir'} incidentes`);
    }

    if (hacia === 'cerrado') {
      const { rows } = await db.query('SELECT count(*) AS n FROM accion_incidente WHERE incidente_id = $1', [id]);
      if (rows[0].n === 0) {
        throw reglaNegocio('RN06_SIN_ACCION', 'No se puede cerrar: registre al menos una acción que justifique la resolución (RN-06)');
      }
    }

    const reapertura = maquina.esReapertura(desde, hacia);
    if (reapertura) {
      if (!d.justificacion) {
        throw reglaNegocio('RN10_SIN_JUSTIFICACION', 'La reapertura exige una justificación, que se registra como acción (RN-10)');
      }
      await db.query(
        'INSERT INTO accion_incidente (incidente_id, usuario_id, descripcion) VALUES ($1, $2, $3)',
        [id, usuario.id, `Reapertura: ${d.justificacion}`]
      );
    }

    const fechas = {
      resuelto: ', fecha_resolucion = now()',
      cerrado: ', fecha_cierre = now()',
    }[hacia] || (reapertura ? ', fecha_resolucion = NULL, fecha_cierre = NULL' : '');
    const nuevoId = await idEstado(db, hacia);
    await db.query(`UPDATE incidente SET estado_id = $2, fecha_actualizacion = now()${fechas} WHERE id = $1`, [id, nuevoId]);

    await historial(db, {
      incidenteId: id, anteriorId: inc.estado_id, nuevoId, usuarioId: usuario.id,
      observacion: d.observacion || (reapertura ? `Reapertura: ${d.justificacion}` : null),
    });
    await auditar(db, {
      usuarioId: usuario.id, incidenteId: id, operacion: reapertura ? 'REABRIR' : 'CAMBIAR_ESTADO',
      entidad: 'incidente', registroId: id, origen,
    });
    return obtenerDetalle(db, id);
  });
}

// RF-030 / RN-04: asignación y reasignación (una sola asignación vigente, CL-07).
async function asignar(id, d, usuario, origen) {
  return transaccion(async (db) => {
    const inc = await bloquear(db, id, usuario, d.version);
    noCerrado(inc);
    const nombreNuevo = await validarResponsable(db, d.responsable_id);
    const actual = (await db.query(
      `SELECT ir.id, ir.usuario_id, u.nombre_completo FROM incidente_responsable ir
       JOIN usuario u ON u.id = ir.usuario_id
       WHERE ir.incidente_id = $1 AND ir.fecha_desasignacion IS NULL`, [id])).rows[0];
    if (actual?.usuario_id === d.responsable_id) {
      throw conflicto('YA_ASIGNADO', 'Ese usuario ya es el responsable vigente');
    }
    if (actual) await db.query('UPDATE incidente_responsable SET fecha_desasignacion = now() WHERE id = $1', [actual.id]);
    const { rows } = await db.query(
      'INSERT INTO incidente_responsable (incidente_id, usuario_id, asignado_por) VALUES ($1, $2, $3) RETURNING id',
      [id, d.responsable_id, usuario.id]
    );
    await tocar(db, id);
    await historial(db, {
      incidenteId: id, anteriorId: inc.estado_id, nuevoId: inc.estado_id, usuarioId: usuario.id,
      observacion: `Reasignado: ${actual?.nombre_completo ?? '—'} → ${nombreNuevo}${d.observacion ? `. ${d.observacion}` : ''}`,
    });
    await auditar(db, { usuarioId: usuario.id, incidenteId: id, operacion: 'ASIGNAR', entidad: 'incidente_responsable', registroId: rows[0].id, origen });
    return obtenerDetalle(db, id);
  });
}

// RF-032 / RN-05: acción (usuario + fecha + descripción). Permitida también en
// incidentes cerrados: es la vía que RN-10 prevé para actualizaciones posteriores.
async function agregarAccion(id, d, usuario, origen) {
  return transaccion(async (db) => {
    await bloquear(db, id, usuario);
    const { rows } = await db.query(
      'INSERT INTO accion_incidente (incidente_id, usuario_id, descripcion, resultado) VALUES ($1, $2, $3, $4) RETURNING id',
      [id, usuario.id, d.descripcion, d.resultado || null]
    );
    await tocar(db, id);
    await auditar(db, { usuarioId: usuario.id, incidenteId: id, operacion: 'REGISTRAR_ACCION', entidad: 'accion_incidente', registroId: rows[0].id, origen });
    return obtenerDetalle(db, id);
  });
}

// RF-033: comentarios.
async function agregarComentario(id, d, usuario, origen) {
  return transaccion(async (db) => {
    const inc = await bloquear(db, id, usuario);
    noCerrado(inc);
    const { rows } = await db.query(
      'INSERT INTO comentario_incidente (incidente_id, usuario_id, texto) VALUES ($1, $2, $3) RETURNING id',
      [id, usuario.id, d.texto]
    );
    await tocar(db, id);
    await auditar(db, { usuarioId: usuario.id, incidenteId: id, operacion: 'COMENTAR', entidad: 'comentario_incidente', registroId: rows[0].id, origen });
    return obtenerDetalle(db, id);
  });
}

// RF-012 / RNF-006: metadatos + hash SHA-256 en BD; el binario fuera de la BD
// (decisión humana 07/10/2026). guardarBinario se ejecuta dentro de la transacción:
// si falla la escritura del archivo, no queda metadato huérfano.
async function agregarEvidencia(id, { nombre, hash }, guardarBinario, usuario, origen) {
  return transaccion(async (db) => {
    const inc = await bloquear(db, id, usuario);
    noCerrado(inc);
    await guardarBinario();
    const { rows } = await db.query(
      `INSERT INTO evidencia (incidente_id, usuario_id, nombre_archivo, hash_integridad)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [id, usuario.id, nombre, hash]
    );
    await tocar(db, id);
    await auditar(db, { usuarioId: usuario.id, incidenteId: id, operacion: 'ADJUNTAR_EVIDENCIA', entidad: 'evidencia', registroId: rows[0].id, origen });
    return obtenerDetalle(db, id);
  });
}

async function obtenerEvidencia(id, evidenciaId, usuario) {
  await verificarAcceso(pool, id, usuario);
  const { rows } = await pool.query(
    'SELECT id, nombre_archivo, hash_integridad FROM evidencia WHERE id = $1 AND incidente_id = $2',
    [evidenciaId, id]
  );
  if (!rows.length) throw noEncontrado('Evidencia no encontrada');
  return rows[0];
}

module.exports = {
  listar, obtener, crear, actualizar, cambiarEstado, asignar,
  agregarAccion, agregarComentario, agregarEvidencia, obtenerEvidencia,
};
