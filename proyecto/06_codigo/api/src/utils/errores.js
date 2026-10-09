// Errores de dominio con código estable (skill error-handling-patterns):
// el cliente decide por `codigo`, no por el texto del mensaje.
class ErrorApp extends Error {
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

const noAutenticado = (m = 'Sesión no válida o expirada') => new ErrorApp(401, 'NO_AUTENTICADO', m);
const prohibido = (m = 'Su rol no permite esta operación') => new ErrorApp(403, 'PROHIBIDO', m);
const noEncontrado = (m = 'Recurso no encontrado') => new ErrorApp(404, 'NO_ENCONTRADO', m);
const conflicto = (codigo, m) => new ErrorApp(409, codigo, m);
const reglaNegocio = (codigo, m) => new ErrorApp(422, codigo, m);

module.exports = { ErrorApp, noAutenticado, prohibido, noEncontrado, conflicto, reglaNegocio };
