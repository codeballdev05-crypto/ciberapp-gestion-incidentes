// Datos de DEMOSTRACIÓN para la landing y el tablero.
// Se crean a través de la capa de servicio de la API (no con SQL directo), así cada
// incidente respeta RN-01…RN-10 y deja historial + auditoría como uno real.
// Idempotente: no hace nada si ya existen incidentes. Nunca en producción.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });
if (process.env.NODE_ENV === 'production') throw new Error('seed-demo no se ejecuta en producción');

const { pool } = require('../src/db/pool');
const { cargarUsuario } = require('../src/middleware/auth');
const svc = require('../src/modulos/incidentes/incidentes.service');

const ORIGEN = 'seed-demo';

// [título, categoría, tipo, severidad, prioridad, responsable, sistema, estado final, acciones, días atrás]
const CASOS = [
  ['Ransomware cifra el servidor de archivos de Contabilidad', 'malware', 'ransomware', 'crítica', 'alta', 'analista', 'FS-CONTA-01', 'cerrado',
    ['Aislamiento del servidor de la red corporativa', 'Restauración desde respaldo inmutable del día anterior'], 26],
  ['Campaña de phishing suplantando a Recursos Humanos', 'phishing', 'phishing por correo', 'alta', 'alta', 'analista2', 'Correo corporativo', 'cerrado',
    ['Bloqueo del dominio remitente en la pasarela de correo', 'Reseteo de credenciales de 4 usuarios que hicieron clic'], 21],
  ['Inicio de sesión desde país no habitual en cuenta de tesorería', 'acceso no autorizado', 'acceso a cuentas', 'alta', 'alta', 'analista', 'Portal bancario', 'resuelto',
    ['Bloqueo preventivo de la cuenta y revisión de sesiones activas'], 14],
  ['Saturación del portal web por tráfico anómalo', 'denegación de servicio', 'ddos', 'alta', 'alta', 'analista2', 'Portal web público', 'en investigación',
    ['Activación de reglas de limitación de tasa en el WAF'], 6],
  ['Base de clientes expuesta en repositorio público', 'fuga de datos', 'exposición pública', 'crítica', 'alta', 'analista', 'Repositorio de código', 'en investigación',
    ['Retiro del repositorio y rotación de secretos expuestos'], 4],
  ['Troyano detectado por el antivirus en portátil de ventas', 'malware', 'troyano', 'media', 'media', 'analista2', 'Portátil VENT-023', 'asignado', [], 3],
  ['SMS fraudulentos a clientes con enlace falso de pago', 'phishing', 'smishing', 'media', 'media', 'analista', 'Canal SMS', 'asignado', [], 2],
  ['Escalamiento de privilegios en servidor de aplicaciones', 'acceso no autorizado', 'escalamiento de privilegios', 'crítica', 'alta', 'analista2', 'APP-SRV-02', 'registrado', [], 1],
  ['Copia masiva a USB de documentos confidenciales', 'fuga de datos', 'fuga por dispositivo', 'alta', 'media', 'analista', 'Estación DIR-004', 'registrado', [], 1],
  ['Correo de spear phishing dirigido a Gerencia', 'phishing', 'spear phishing', 'baja', 'baja', 'analista2', 'Correo corporativo', 'registrado', [], 0],
];

const CAMINO = ['asignado', 'en investigación', 'resuelto', 'cerrado'];

(async () => {
  const { rows } = await pool.query('SELECT count(*) AS n FROM incidente');
  if (rows[0].n > 0) {
    console.log(`= Ya existen ${rows[0].n} incidentes: no se cargan datos demo.`);
    return pool.end();
  }
  const cat = async (tabla, nombre) => (await pool.query(`SELECT id FROM ${tabla} WHERE nombre = $1`, [nombre])).rows[0].id;
  const usuarioDemo = async (u) => cargarUsuario((await pool.query('SELECT id FROM usuario WHERE usuario = $1', [u])).rows[0].id);
  const gestor = await usuarioDemo('gestor');

  for (const [titulo, categoria, tipo, sev, pri, resp, sistema, final, acciones, dias] of CASOS) {
    const analista = await usuarioDemo(resp);
    let inc = await svc.crear({
      titulo,
      descripcion: `${titulo}. Caso de demostración para la presentación del sistema.`,
      categoria_id: await cat('categoria', categoria),
      tipo_id: await cat('tipo_incidente', tipo),
      severidad_id: await cat('severidad', sev),
      prioridad_id: await cat('prioridad', pri),
      responsable_id: analista.id,
      sistema_afectado: sistema,
    }, gestor, ORIGEN);

    for (const estado of CAMINO.slice(0, CAMINO.indexOf(final) + 1)) {
      if (estado === 'cerrado' || estado === 'resuelto') {
        for (const descripcion of acciones) {
          inc = await svc.agregarAccion(inc.id, { descripcion, resultado: 'Completado' }, analista, ORIGEN);
        }
        acciones.length = 0;
      }
      const actor = estado === 'cerrado' ? gestor : analista;
      inc = await svc.cambiarEstado(inc.id, { version: inc.version, estado, observacion: null }, actor, ORIGEN);
    }
    if (final === 'en investigación' || final === 'asignado') {
      for (const descripcion of acciones) inc = await svc.agregarAccion(inc.id, { descripcion }, analista, ORIGEN);
    }

    // Fechas escalonadas hacia atrás para que el tablero muestre una tendencia realista.
    // (Ajuste de presentación con el rol administrativo; no altera la lógica del caso.)
    await ajustarFechas(inc.id, dias);
    console.log(`+ ${inc.codigo} [${final}] ${titulo}`);
  }
  await pool.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });

// El rol de la app no puede modificar historial/auditoría (append-only, por diseño).
// Para desplazar las fechas de la DEMO se usa la conexión administrativa del .env.
async function ajustarFechas(id, dias) {
  const { Client } = require('pg');
  const adm = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });
  await adm.connect();
  const desfase = `${dias} days`;
  await adm.query('BEGIN');
  await adm.query(`UPDATE incidente SET fecha_registro = fecha_registro - $2::interval,
                     fecha_resolucion = fecha_resolucion - $2::interval + interval '1 day' * LEAST($3, 2),
                     fecha_cierre = fecha_cierre - $2::interval + interval '1 day' * LEAST($3, 3),
                     fecha_actualizacion = fecha_actualizacion - $2::interval + interval '1 day' * LEAST($3, 3)
                   WHERE id = $1`, [id, desfase, dias]);
  // Historial coherente con las fechas del incidente: cada estado, en un momento plausible.
  await adm.query(`UPDATE historial_incidente h SET fecha = h.fecha - $2::interval + CASE e.nombre
                     WHEN 'asignado' THEN interval '2 hours'
                     WHEN 'en investigación' THEN interval '6 hours'
                     WHEN 'resuelto' THEN interval '1 day' * LEAST($3, 2)
                     WHEN 'cerrado' THEN interval '1 day' * LEAST($3, 3)
                     ELSE interval '0' END
                   FROM estado_incidente e WHERE e.id = h.estado_nuevo_id AND h.incidente_id = $1`, [id, desfase, dias]);
  await adm.query(`UPDATE accion_incidente SET fecha = fecha - $2::interval + interval '12 hours' * LEAST($3, 1)
                   WHERE incidente_id = $1`, [id, desfase, dias]);
  await adm.query('UPDATE incidente_responsable SET fecha_asignacion = fecha_asignacion - $2::interval WHERE incidente_id = $1', [id, desfase]);
  await adm.query('COMMIT');
  await adm.end();
}
