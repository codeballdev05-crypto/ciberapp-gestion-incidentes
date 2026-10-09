// RF-020 / RF-021 / RF-031: catálogos activos para formularios y filtros.
const { Router } = require('express');
const { pool } = require('../../db/pool');
const { TRANSICIONES } = require('../incidentes/maquina-estados');

const router = Router();

router.get('/', async (_req, res) => {
  const consulta = (tabla) =>
    pool.query(`SELECT id, nombre, descripcion, orden FROM ${tabla} WHERE activo ORDER BY orden, nombre`);
  const [categorias, severidades, prioridades, estados, tipos] = await Promise.all([
    consulta('categoria'),
    consulta('severidad'),
    consulta('prioridad'),
    consulta('estado_incidente'),
    pool.query('SELECT id, categoria_id, nombre, descripcion, orden FROM tipo_incidente WHERE activo ORDER BY categoria_id, orden'),
  ]);
  res.json({
    data: {
      categorias: categorias.rows,
      tipos: tipos.rows,
      severidades: severidades.rows,
      prioridades: prioridades.rows,
      estados: estados.rows,
      transiciones: TRANSICIONES,
    },
  });
});

module.exports = router;
