// Configuración externa al código (ADR §principios). Secretos solo desde .env.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../../.env'), quiet: true });

const requeridas = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'APP_DB_USER', 'APP_DB_PASSWORD', 'JWT_SECRET'];
const faltantes = requeridas.filter((v) => !process.env[v]);
if (faltantes.length) {
  throw new Error(`Faltan variables en .env: ${faltantes.join(', ')}. Ejecute "npm run setup".`);
}

module.exports = {
  produccion: process.env.NODE_ENV === 'production',
  puerto: Number(process.env.API_PORT || 3000),
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    // La API se conecta con el rol de MÍNIMO PRIVILEGIO (V004/V005/V006), nunca con el superusuario.
    user: process.env.APP_DB_USER,
    password: process.env.APP_DB_PASSWORD,
  },
  jwt: {
    secreto: process.env.JWT_SECRET,
    duracionMin: 30, // skill auth-implementation-patterns: tokens de vida corta (15–30 min)
    renovarSiQuedanMin: 10, // sesión deslizante: se reemite si quedan < 10 min
  },
  frontendOrigen: process.env.FRONTEND_ORIGIN || null,
  evidencias: {
    directorio: process.env.EVIDENCIAS_DIR || path.resolve(__dirname, '../../../../../data/evidencias'),
    maxBytes: 10 * 1024 * 1024,
    extensiones: ['.pdf', '.png', '.jpg', '.jpeg', '.txt', '.log', '.csv', '.json', '.pcap', '.zip'],
  },
};
