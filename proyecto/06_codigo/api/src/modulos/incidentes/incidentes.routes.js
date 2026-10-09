const { Router } = require('express');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../../config/env');
const esquemas = require('../../utils/esquemas');
const { reglaNegocio, ErrorApp } = require('../../utils/errores');
const { requierePermiso } = require('../../middleware/auth');
const servicio = require('./incidentes.service');

const router = Router();
const LEER = ['incidente:leer_todos', 'incidente:leer_asignados'];
const idParam = (req) => esquemas.id.parse(req.params.id);

// Evidencias: en memoria (máx. 10 MB, 1 archivo), lista blanca de extensiones (RNF-006, R-08).
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.evidencias.maxBytes, files: 1 },
  fileFilter: (_req, archivo, cb) => {
    const ext = path.extname(archivo.originalname).toLowerCase();
    if (!config.evidencias.extensiones.includes(ext)) {
      return cb(reglaNegocio('EXTENSION_NO_PERMITIDA', `Extensión no permitida. Use: ${config.evidencias.extensiones.join(', ')}`));
    }
    cb(null, true);
  },
});

router.get('/', requierePermiso(...LEER), async (req, res) => {
  res.json(await servicio.listar(esquemas.filtrosIncidentes.parse(req.query), req.usuario));
});

router.post('/', requierePermiso('incidente:crear'), async (req, res) => {
  const datos = await servicio.crear(esquemas.crearIncidente.parse(req.body), req.usuario, req.ip);
  res.status(201).location(`/api/v1/incidentes/${datos.id}`).json({ data: datos });
});

router.get('/:id', requierePermiso(...LEER), async (req, res) => {
  res.json({ data: await servicio.obtener(idParam(req), req.usuario) });
});

router.patch('/:id', requierePermiso('incidente:editar'), async (req, res) => {
  res.json({ data: await servicio.actualizar(idParam(req), esquemas.actualizarIncidente.parse(req.body), req.usuario, req.ip) });
});

router.post('/:id/estado', requierePermiso('incidente:atender', 'incidente:cerrar'), async (req, res) => {
  res.json({ data: await servicio.cambiarEstado(idParam(req), esquemas.cambiarEstado.parse(req.body), req.usuario, req.ip) });
});

router.post('/:id/asignacion', requierePermiso('incidente:asignar'), async (req, res) => {
  res.json({ data: await servicio.asignar(idParam(req), esquemas.asignar.parse(req.body), req.usuario, req.ip) });
});

router.post('/:id/acciones', requierePermiso('incidente:atender'), async (req, res) => {
  res.status(201).json({ data: await servicio.agregarAccion(idParam(req), esquemas.accion.parse(req.body), req.usuario, req.ip) });
});

router.post('/:id/comentarios', requierePermiso('incidente:atender'), async (req, res) => {
  res.status(201).json({ data: await servicio.agregarComentario(idParam(req), esquemas.comentario.parse(req.body), req.usuario, req.ip) });
});

router.post('/:id/evidencias', requierePermiso('incidente:atender'), subida.single('archivo'), async (req, res) => {
  if (!req.file) throw reglaNegocio('ARCHIVO_REQUERIDO', 'Adjunte un archivo en el campo "archivo"');
  const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  // multer entrega el nombre en latin1; se normaliza y se sanea (nunca se usa como ruta).
  const nombre = path
    .basename(Buffer.from(req.file.originalname, 'latin1').toString('utf8'))
    .replace(/[\x00-\x1f<>:"/\\|?*]/g, '_')
    .slice(-255);
  // Almacenamiento direccionado por contenido: el archivo se llama como su hash.
  const guardarBinario = async () => {
    await fs.mkdir(config.evidencias.directorio, { recursive: true });
    try {
      await fs.writeFile(path.join(config.evidencias.directorio, hash), req.file.buffer, { flag: 'wx' });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e; // mismo contenido ya almacenado
    }
  };
  const datos = await servicio.agregarEvidencia(idParam(req), { nombre, hash }, guardarBinario, req.usuario, req.ip);
  res.status(201).json({ data: datos });
});

// Descarga con verificación de integridad: se recalcula el SHA-256 y se compara con el registrado.
router.get('/:id/evidencias/:evidenciaId/archivo', requierePermiso(...LEER), async (req, res) => {
  const ev = await servicio.obtenerEvidencia(idParam(req), esquemas.id.parse(req.params.evidenciaId), req.usuario);
  let contenido;
  try {
    contenido = await fs.readFile(path.join(config.evidencias.directorio, ev.hash_integridad));
  } catch {
    throw new ErrorApp(404, 'BINARIO_NO_DISPONIBLE', 'El archivo de la evidencia no está disponible en el almacenamiento');
  }
  const integro = crypto.createHash('sha256').update(contenido).digest('hex') === ev.hash_integridad;
  res.set('X-Integridad-Verificada', integro ? 'si' : 'no');
  res.attachment(ev.nombre_archivo).type('application/octet-stream').send(contenido);
});

module.exports = router;
