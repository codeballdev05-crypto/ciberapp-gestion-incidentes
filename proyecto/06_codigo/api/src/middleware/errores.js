const { ZodError } = require('zod');
const { ErrorApp } = require('../utils/errores');

// Formato único de error: { error: { codigo, mensaje, detalles? } }.
// Nunca se exponen trazas ni SQL al cliente (skill error-handling-patterns / secure-software-engineering).
function manejadorErrores(err, req, res, _next) {
  if (err instanceof ErrorApp) {
    return res.status(err.status).json({ error: { codigo: err.codigo, mensaje: err.message, detalles: err.detalles } });
  }
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        codigo: 'VALIDACION',
        mensaje: 'Datos de entrada inválidos',
        detalles: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      },
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo no es JSON válido' } });
  }
  if (err.name === 'MulterError') {
    const mensaje = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo (10 MB)' : 'Archivo inválido';
    return res.status(422).json({ error: { codigo: 'ARCHIVO_INVALIDO', mensaje } });
  }
  // Restricciones de la BD como última línea de defensa (la API valida antes).
  const porSqlState = {
    23505: [409, 'DUPLICADO', 'Ya existe un registro con ese valor único'],
    23503: [422, 'REFERENCIA_INVALIDA', 'Referencia a un registro inexistente'],
    23514: [422, 'RESTRICCION', 'El dato viola una regla de integridad'],
    23502: [422, 'RESTRICCION', 'Falta un dato obligatorio'],
  };
  if (porSqlState[err.code]) {
    const [status, codigo, mensaje] = porSqlState[err.code];
    return res.status(status).json({ error: { codigo, mensaje } });
  }
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor' } });
}

function noEncontradoRuta(req, res) {
  res.status(404).json({ error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: `No existe ${req.method} ${req.path}` } });
}

module.exports = { manejadorErrores, noEncontradoRuta };
