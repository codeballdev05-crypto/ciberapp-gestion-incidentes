const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const config = require('./config/env');
const { pool } = require('./db/pool');
const { autenticar } = require('./middleware/auth');
const { manejadorErrores, noEncontradoRuta } = require('./middleware/errores');

const app = express();
app.disable('x-powered-by');

// Contrato OpenAPI (skill openapi-spec-generation) servido como documentación interactiva.
const openapi = YAML.parse(fs.readFileSync(path.join(__dirname, '../openapi/openapi.yaml'), 'utf8'));
app.get('/api/openapi.json', (_req, res) => res.json(openapi));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'CiberApp API' }));

app.use(helmet());
if (config.frontendOrigen) app.use(cors({ origin: config.frontendOrigen, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Registro de peticiones SIN cuerpos (nunca se registran contraseñas ni datos de incidentes).
app.use((req, res, next) => {
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return;
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(1)}ms u=${req.usuario?.id ?? '-'}`);
  });
  next();
});

// Límite global (skill api-design-principles: rate limiting).
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: { codigo: 'DEMASIADAS_PETICIONES', mensaje: 'Demasiadas peticiones' } }),
}));

const v1 = express.Router();

// Salud (público): estado de la API y de la base de datos (observabilidad, ADR §infra).
v1.get('/salud', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ data: { estado: 'ok', base_datos: 'ok', fecha: new Date().toISOString() } });
  } catch {
    res.status(503).json({ data: { estado: 'degradado', base_datos: 'sin conexión' } });
  }
});

v1.use('/auth', require('./modulos/auth/auth.routes'));
v1.use(autenticar); // todo lo siguiente exige sesión
v1.use('/catalogos', require('./modulos/catalogos/catalogos.routes'));
v1.use('/incidentes', require('./modulos/incidentes/incidentes.routes'));
v1.use('/usuarios', require('./modulos/usuarios/usuarios.routes'));
v1.use('/', require('./modulos/reportes/reportes.routes'));

app.use('/api/v1', v1);
app.use(noEncontradoRuta);
app.use(manejadorErrores);

module.exports = app;
