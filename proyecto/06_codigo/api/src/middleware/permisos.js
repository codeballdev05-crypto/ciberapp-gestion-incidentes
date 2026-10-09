// Matriz funcionalidad × rol (RN-08, RNF-002). Detalla la matriz básica aprobada
// el 07/10/2026 (seguridad.md §7). La autorización SIEMPRE se evalúa en el servidor.
const PERMISOS = {
  'incidente:leer_todos': ['administrador', 'gestor', 'consultor'],
  'incidente:leer_asignados': ['analista'], // solo incidentes donde es responsable vigente
  'incidente:crear': ['administrador', 'gestor'],
  'incidente:editar': ['administrador', 'gestor'],
  'incidente:asignar': ['administrador', 'gestor'],
  'incidente:atender': ['administrador', 'gestor', 'analista'], // acciones, comentarios, evidencias, avance de estado
  'incidente:cerrar': ['administrador', 'gestor'], // resuelto → cerrado y reapertura
  'usuario:listar': ['administrador', 'gestor'],
  'usuario:administrar': ['administrador'],
  'reporte:ver': ['administrador', 'gestor', 'consultor'],
  'auditoria:ver': ['administrador'],
};

const puede = (usuario, permiso) => usuario.roles.some((r) => PERMISOS[permiso].includes(r));

module.exports = { PERMISOS, puede };
