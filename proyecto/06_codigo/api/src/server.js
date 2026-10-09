const config = require('./config/env');
const app = require('./app');
const { pool } = require('./db/pool');

const servidor = app.listen(config.puerto, () => {
  console.log(`CiberApp API escuchando en http://localhost:${config.puerto}`);
  console.log(`Documentación: http://localhost:${config.puerto}/api/docs`);
});

// Cierre ordenado: deja de aceptar conexiones y libera el pool.
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => servidor.close(() => pool.end().then(() => process.exit(0))));
}
