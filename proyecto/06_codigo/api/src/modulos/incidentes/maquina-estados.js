// Máquina de estados ÚNICA (ADR §principios; decisión humana 07/10/2026; RN-02).
//   registrado → asignado → en investigación → resuelto → cerrado
//   cerrado → en investigación   (reapertura, RN-10: exige justificación registrada como acción)
const TRANSICIONES = {
  registrado: ['asignado'],
  asignado: ['en investigación'],
  'en investigación': ['resuelto'],
  resuelto: ['cerrado'],
  cerrado: ['en investigación'],
};

// Qué permiso exige cada transición (RN-08). Cerrar y reabrir son decisiones de gestión.
function permisoTransicion(desde, hacia) {
  if (hacia === 'cerrado' || desde === 'cerrado') return 'incidente:cerrar';
  return 'incidente:atender';
}

const esValida = (desde, hacia) => (TRANSICIONES[desde] || []).includes(hacia);
const esReapertura = (desde, hacia) => desde === 'cerrado' && hacia === 'en investigación';

module.exports = { TRANSICIONES, permisoTransicion, esValida, esReapertura };
