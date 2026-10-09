// RF-060 (cobertura mínima) y RF-070 (consulta de bitácora).
// Nota de alcance: AR-B05 dejó el módulo completo de reportes fuera de esta fase.
// Este resumen agregado alimenta el tablero y queda marcado para validación humana.
const { Router } = require('express');
const { pool } = require('../../db/pool');
const esquemas = require('../../utils/esquemas');
const { requierePermiso } = require('../../middleware/auth');

const router = Router();

router.get('/reportes/resumen', requierePermiso('reporte:ver'), async (_req, res) => {
  const agrupar = (tabla, col) =>
    pool.query(`SELECT x.nombre, x.orden, count(i.id)::int AS total
                FROM ${tabla} x LEFT JOIN incidente i ON i.${col} = x.id
                WHERE x.activo GROUP BY x.id ORDER BY x.orden`);
  const [porEstado, porSeveridad, porCategoria, totales, tendencia] = await Promise.all([
    agrupar('estado_incidente', 'estado_id'),
    agrupar('severidad', 'severidad_id'),
    agrupar('categoria', 'categoria_id'),
    pool.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE e.nombre <> 'cerrado')::int AS abiertos,
             count(*) FILTER (WHERE e.nombre <> 'cerrado' AND s.nombre = 'crítica')::int AS criticos_abiertos,
             round(avg(extract(epoch FROM (i.fecha_resolucion - i.fecha_registro)) / 3600)
                   FILTER (WHERE i.fecha_resolucion IS NOT NULL)::numeric, 1) AS horas_promedio_resolucion
      FROM incidente i
      JOIN estado_incidente e ON e.id = i.estado_id
      JOIN severidad s ON s.id = i.severidad_id`),
    pool.query(`
      SELECT to_char(d, 'YYYY-MM-DD') AS fecha, count(i.id)::int AS total
      FROM generate_series(current_date - 29, current_date, interval '1 day') d
      LEFT JOIN incidente i ON i.fecha_registro::date = d::date
      GROUP BY d ORDER BY d`),
  ]);
  res.json({
    data: {
      ...totales.rows[0],
      por_estado: porEstado.rows,
      por_severidad: porSeveridad.rows,
      por_categoria: porCategoria.rows,
      registrados_ultimos_30_dias: tendencia.rows,
    },
  });
});

router.get('/auditoria', requierePermiso('auditoria:ver'), async (req, res) => {
  const { pagina, por_pagina } = esquemas.paginacion.parse(req.query);
  const { rows } = await pool.query(
    `SELECT count(*) OVER()::int AS total_filas, a.id, a.fecha, a.operacion, a.entidad, a.registro_id, a.origen,
            i.codigo AS incidente, u.usuario
     FROM auditoria a
     LEFT JOIN usuario u ON u.id = a.usuario_id
     LEFT JOIN incidente i ON i.id = a.incidente_id
     ORDER BY a.fecha DESC, a.id DESC LIMIT $1 OFFSET $2`,
    [por_pagina, (pagina - 1) * por_pagina]
  );
  const total = rows[0]?.total_filas ?? 0;
  res.json({
    data: rows.map(({ total_filas, ...r }) => r),
    meta: { pagina, por_pagina, total, paginas: Math.ceil(total / por_pagina) },
  });
});

module.exports = router;
