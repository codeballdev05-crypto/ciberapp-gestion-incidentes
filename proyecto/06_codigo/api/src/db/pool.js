const { Pool, types } = require('pg');
const config = require('../config/env');

// BIGINT (int8) → number. Seguro: los identificadores no superan 2^53.
types.setTypeParser(20, (v) => Number(v));
// NUMERIC → number (promedios de reportes).
types.setTypeParser(1700, (v) => Number(v));

const pool = new Pool({ ...config.db, max: 10, idleTimeoutMillis: 30000 });

// Ejecuta fn dentro de una transacción (READ COMMITTED, decisión Paso 12).
// Cambio + historial + auditoría van en la MISMA transacción (ADR §principios, RNF-022).
async function transaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (e) {
    await cliente.query('ROLLBACK');
    throw e;
  } finally {
    cliente.release();
  }
}

module.exports = { pool, transaccion };
