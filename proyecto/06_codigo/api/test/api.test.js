// Pruebas de la API contra la base AISLADA <DB_NAME>_test (npm run db:test-setup).
// Cada caso declara el RF/RN que verifica. Ejecutar: npm test
const path = require('path');
const crypto = require('crypto');
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });
process.env.DB_NAME = `${process.env.DB_NAME}_test`;
process.env.NODE_ENV = 'test';
process.env.LOGIN_RATE_LIMIT = '1000';
process.env.EVIDENCIAS_DIR = path.resolve(__dirname, '../../../../data/evidencias_test');

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/pool');

const CLAVE = process.env.DEMO_PASSWORD;
const sesiones = {};
async function sesion(usuario) {
  const agente = request.agent(app);
  const r = await agente.post('/api/v1/auth/login').send({ usuario, contrasena: CLAVE });
  assert.equal(r.status, 200, `login ${usuario}: ${JSON.stringify(r.body)}`);
  return agente;
}

let cat; // catálogos
let ids; // usuarios demo
const porNombre = (lista, nombre) => lista.find((x) => x.nombre === nombre).id;

function datosIncidente(extra = {}) {
  const malware = porNombre(cat.categorias, 'malware');
  return {
    titulo: `Prueba ${crypto.randomBytes(3).toString('hex')}`,
    descripcion: 'Incidente generado por la suite de pruebas',
    categoria_id: malware,
    tipo_id: cat.tipos.find((t) => t.nombre === 'ransomware').id,
    severidad_id: porNombre(cat.severidades, 'alta'),
    prioridad_id: porNombre(cat.prioridades, 'alta'),
    responsable_id: ids.analista,
    sistema_afectado: 'SRV-TEST',
    ...extra,
  };
}

before(async () => {
  for (const u of ['admin', 'gestor', 'analista', 'analista2', 'consultor']) sesiones[u] = await sesion(u);
  cat = (await sesiones.gestor.get('/api/v1/catalogos')).body.data;
  const usuarios = (await sesiones.admin.get('/api/v1/usuarios')).body.data;
  ids = Object.fromEntries(usuarios.map((u) => [u.usuario, u.id]));
});

after(() => pool.end());

describe('Salud y autenticación (RF-001, RNF-001)', () => {
  test('GET /salud responde ok con BD conectada', async () => {
    const r = await request(app).get('/api/v1/salud');
    assert.equal(r.status, 200);
    assert.equal(r.body.data.base_datos, 'ok');
  });

  test('login incorrecto → 401 con mensaje genérico (no revela si el usuario existe)', async () => {
    const a = await request(app).post('/api/v1/auth/login').send({ usuario: 'gestor', contrasena: 'mala-clave-123' });
    const b = await request(app).post('/api/v1/auth/login').send({ usuario: 'no-existe', contrasena: 'mala-clave-123' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.error.mensaje, b.body.error.mensaje);
  });

  test('login correcto emite cookie httpOnly + SameSite=Strict, sin token en el cuerpo', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ usuario: 'consultor', contrasena: CLAVE });
    assert.equal(r.status, 200);
    const cookie = r.headers['set-cookie'][0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.ok(!JSON.stringify(r.body).includes(cookie.split(';')[0].split('=')[1]));
    assert.deepEqual(r.body.data.roles, ['consultor']);
  });

  test('sin sesión → 401', async () => {
    const r = await request(app).get('/api/v1/incidentes');
    assert.equal(r.status, 401);
    assert.equal(r.body.error.codigo, 'NO_AUTENTICADO');
  });

  test('el login fallido queda en auditoría (RNF-040)', async () => {
    const r = await sesiones.admin.get('/api/v1/auditoria?por_pagina=100');
    assert.ok(r.body.data.some((a) => a.operacion === 'LOGIN_FALLIDO'));
  });
});

describe('Registro de incidentes (RF-010, RF-011, RF-020, RF-021, RN-01, RN-04)', () => {
  test('gestor registra: 201, código INC-, estado registrado, responsable, historial y auditoría', async () => {
    const r = await sesiones.gestor.post('/api/v1/incidentes').send(datosIncidente());
    assert.equal(r.status, 201);
    const inc = r.body.data;
    assert.match(inc.codigo, /^INC-\d{6}$/);
    assert.equal(inc.estado.nombre, 'registrado');
    assert.equal(inc.responsable.id, ids.analista);
    assert.equal(inc.historial.length, 1);
    assert.equal(inc.historial[0].estado_anterior, null);
    const { rows } = await pool.query("SELECT 1 FROM auditoria WHERE operacion = 'CREAR' AND registro_id = $1", [inc.id]);
    assert.equal(rows.length, 1);
  });

  test('RN-01: sin responsable → 422', async () => {
    const { responsable_id, ...sinResp } = datosIncidente();
    const r = await sesiones.gestor.post('/api/v1/incidentes').send(sinResp);
    assert.equal(r.status, 422);
    // RNF-051: el mensaje dice qué falta, en español (hallazgo de la revisión del paso 4)
    assert.ok(r.body.error.detalles.some((d) => d.campo === 'responsable_id' && d.mensaje === 'Obligatorio'));
  });

  test('RN-01: responsable con rol consultor → 422 RESPONSABLE_INVALIDO', async () => {
    const r = await sesiones.gestor.post('/api/v1/incidentes').send(datosIncidente({ responsable_id: ids.consultor }));
    assert.equal(r.status, 422);
    assert.equal(r.body.error.codigo, 'RESPONSABLE_INVALIDO');
  });

  test('RN-04: severidad crítica con prioridad baja → 422', async () => {
    const r = await sesiones.gestor.post('/api/v1/incidentes').send(datosIncidente({
      severidad_id: porNombre(cat.severidades, 'crítica'),
      prioridad_id: porNombre(cat.prioridades, 'baja'),
    }));
    assert.equal(r.status, 422);
    assert.equal(r.body.error.codigo, 'RN04_CRITICO_PRIORIDAD');
  });

  test('RF-020: tipo que no pertenece a la categoría → 422', async () => {
    const r = await sesiones.gestor.post('/api/v1/incidentes').send(datosIncidente({
      tipo_id: cat.tipos.find((t) => t.nombre === 'smishing').id,
    }));
    assert.equal(r.status, 422);
    assert.equal(r.body.error.codigo, 'TIPO_NO_PERTENECE');
  });

  test('RN-08: consultor y analista no pueden registrar → 403', async () => {
    for (const u of ['consultor', 'analista']) {
      const r = await sesiones[u].post('/api/v1/incidentes').send(datosIncidente());
      assert.equal(r.status, 403, u);
    }
  });
});

describe('Ciclo de vida completo (RF-031, RF-032, RF-050, RN-02, RN-05, RN-06, RN-10)', () => {
  let inc;
  const estado = (usuario, estado, extra = {}) =>
    sesiones[usuario].post(`/api/v1/incidentes/${inc.id}/estado`).send({ version: inc.version, estado, ...extra });

  before(async () => {
    inc = (await sesiones.gestor.post('/api/v1/incidentes').send(datosIncidente())).body.data;
  });

  test('RN-02: salto no permitido registrado → resuelto → 409 TRANSICION_INVALIDA', async () => {
    const r = await estado('gestor', 'resuelto');
    assert.equal(r.status, 409);
    assert.equal(r.body.error.codigo, 'TRANSICION_INVALIDA');
  });

  test('analista responsable avanza registrado → asignado → en investigación → resuelto', async () => {
    for (const e of ['asignado', 'en investigación', 'resuelto']) {
      const r = await estado('analista', e, { observacion: `Paso a ${e}` });
      assert.equal(r.status, 200, `${e}: ${JSON.stringify(r.body)}`);
      inc = r.body.data;
      assert.equal(inc.estado.nombre, e);
    }
    assert.ok(inc.fecha_resolucion);
    assert.equal(inc.historial.length, 4);
  });

  test('RN-08: el analista no puede cerrar → 403', async () => {
    const r = await estado('analista', 'cerrado');
    assert.equal(r.status, 403);
  });

  test('RN-06: cerrar sin acciones registradas → 422 RN06_SIN_ACCION', async () => {
    const r = await estado('gestor', 'cerrado');
    assert.equal(r.status, 422);
    assert.equal(r.body.error.codigo, 'RN06_SIN_ACCION');
  });

  test('RN-05: la acción guarda usuario, fecha y descripción', async () => {
    const r = await sesiones.analista.post(`/api/v1/incidentes/${inc.id}/acciones`)
      .send({ descripcion: 'Restauración desde respaldo', resultado: 'Servicio restablecido' });
    assert.equal(r.status, 201);
    inc = r.body.data;
    const a = inc.acciones.at(-1);
    assert.equal(a.usuario.id, ids.analista);
    assert.ok(a.fecha);
    assert.equal(a.descripcion, 'Restauración desde respaldo');
  });

  test('gestor cierra tras la acción → 200 y fecha_cierre', async () => {
    const r = await estado('gestor', 'cerrado', { observacion: 'Verificado' });
    assert.equal(r.status, 200);
    inc = r.body.data;
    assert.equal(inc.estado.nombre, 'cerrado');
    assert.ok(inc.fecha_cierre);
  });

  test('RN-10: incidente cerrado no admite PATCH ni comentarios → 409', async () => {
    const p = await sesiones.gestor.patch(`/api/v1/incidentes/${inc.id}`).send({ version: inc.version, titulo: 'Cambio' });
    assert.equal(p.status, 409);
    assert.equal(p.body.error.codigo, 'INCIDENTE_CERRADO');
    const c = await sesiones.gestor.post(`/api/v1/incidentes/${inc.id}/comentarios`).send({ texto: 'Hola' });
    assert.equal(c.status, 409);
  });

  test('RN-10: reabrir sin justificación → 422', async () => {
    const r = await estado('gestor', 'en investigación');
    assert.equal(r.status, 422);
    assert.equal(r.body.error.codigo, 'RN10_SIN_JUSTIFICACION');
  });

  test('RN-10: reabrir con justificación la registra como acción y limpia fechas', async () => {
    const acciones = inc.acciones.length;
    const r = await estado('gestor', 'en investigación', { justificacion: 'Se detectó reinfección' });
    assert.equal(r.status, 200);
    inc = r.body.data;
    assert.equal(inc.estado.nombre, 'en investigación');
    assert.equal(inc.acciones.length, acciones + 1);
    assert.match(inc.acciones.at(-1).descripcion, /^Reapertura: /);
    assert.equal(inc.fecha_cierre, null);
    assert.equal(inc.fecha_resolucion, null);
  });

  test('RN-07: el historial conserva todas las transiciones en orden', async () => {
    const estados = inc.historial.map((h) => h.estado_nuevo);
    assert.deepEqual(estados, ['registrado', 'asignado', 'en investigación', 'resuelto', 'cerrado', 'en investigación']);
  });
});

describe('Concurrencia, asignación y visibilidad (DB-B12, RF-030, RN-08)', () => {
  let inc;
  before(async () => {
    inc = (await sesiones.gestor.post('/api/v1/incidentes').send(datosIncidente())).body.data;
  });

  test('DB-B12: PATCH con versión desactualizada → 409 VERSION_DESACTUALIZADA', async () => {
    const ok = await sesiones.gestor.patch(`/api/v1/incidentes/${inc.id}`).send({ version: inc.version, titulo: 'Primera edición' });
    assert.equal(ok.status, 200);
    const viejo = await sesiones.admin.patch(`/api/v1/incidentes/${inc.id}`).send({ version: inc.version, titulo: 'Edición perdida' });
    assert.equal(viejo.status, 409);
    assert.equal(viejo.body.error.codigo, 'VERSION_DESACTUALIZADA');
    inc = ok.body.data;
  });

  test('RN-07: el cambio de severidad queda en el historial con valor anterior → nuevo', async () => {
    const r = await sesiones.gestor.patch(`/api/v1/incidentes/${inc.id}`).send({
      version: inc.version, severidad_id: porNombre(cat.severidades, 'media'),
    });
    assert.equal(r.status, 200);
    inc = r.body.data;
    assert.match(inc.historial.at(-1).observacion, /severidad: alta → media/);
  });

  test('RN-08: analista2 no ve el incidente del analista (404, no revela existencia)', async () => {
    const r = await sesiones.analista2.get(`/api/v1/incidentes/${inc.id}`);
    assert.equal(r.status, 404);
    const lista = await sesiones.analista2.get('/api/v1/incidentes?por_pagina=100');
    assert.ok(!lista.body.data.some((i) => i.id === inc.id));
  });

  test('RF-030: reasignar a analista2 cierra la asignación anterior y le da visibilidad', async () => {
    const r = await sesiones.gestor.post(`/api/v1/incidentes/${inc.id}/asignacion`)
      .send({ version: inc.version, responsable_id: ids.analista2, observacion: 'Carga de trabajo' });
    assert.equal(r.status, 200);
    inc = r.body.data;
    assert.equal(inc.responsable.id, ids.analista2);
    assert.equal(inc.responsables.length, 2);
    assert.ok(inc.responsables[0].fecha_desasignacion);
    assert.equal((await sesiones.analista2.get(`/api/v1/incidentes/${inc.id}`)).status, 200);
    assert.equal((await sesiones.analista.get(`/api/v1/incidentes/${inc.id}`)).status, 404);
  });

  test('RF-030: reasignar al mismo responsable → 409 YA_ASIGNADO', async () => {
    const r = await sesiones.gestor.post(`/api/v1/incidentes/${inc.id}/asignacion`)
      .send({ version: inc.version, responsable_id: ids.analista2 });
    assert.equal(r.status, 409);
  });

  test('consultor ve todos los incidentes pero no puede modificar', async () => {
    assert.equal((await sesiones.consultor.get(`/api/v1/incidentes/${inc.id}`)).status, 200);
    const r = await sesiones.consultor.post(`/api/v1/incidentes/${inc.id}/acciones`).send({ descripcion: 'x' });
    assert.equal(r.status, 403);
  });
});

describe('Búsqueda, evidencias, usuarios y reportes (RF-041, RF-012, RF-001, RF-060, RF-070)', () => {
  let inc;
  // La BD de pruebas no se vacía entre ejecuciones (sin operaciones destructivas): valor único por corrida.
  const SISTEMA = `ERP-${crypto.randomBytes(4).toString('hex')}`;
  before(async () => {
    inc = (await sesiones.gestor.post('/api/v1/incidentes').send(datosIncidente({ sistema_afectado: SISTEMA }))).body.data;
  });

  test('RF-041: búsqueda por texto y filtro por estado', async () => {
    const r = await sesiones.consultor.get(`/api/v1/incidentes?q=${SISTEMA}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 1);
    assert.equal(r.body.data[0].id, inc.id);
    const registrado = porNombre(cat.estados, 'registrado');
    const f = await sesiones.consultor.get(`/api/v1/incidentes?estado=${registrado}&por_pagina=100`);
    assert.ok(f.body.data.every((i) => i.estado.nombre === 'registrado'));
    assert.ok(f.body.meta.total >= 1);
  });

  test('RF-041: búsqueda con comodines SQL no rompe ni filtra de más', async () => {
    const r = await sesiones.consultor.get(`/api/v1/incidentes?q=${encodeURIComponent("%' OR 1=1 --")}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 0);
  });

  test('RF-012: evidencia guarda SHA-256 correcto y la descarga verifica integridad', async () => {
    const contenido = Buffer.from(`log de prueba ${Date.now()}`);
    const hash = crypto.createHash('sha256').update(contenido).digest('hex');
    const r = await sesiones.analista.post(`/api/v1/incidentes/${inc.id}/evidencias`)
      .attach('archivo', contenido, 'firewall.log');
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const ev = r.body.data.evidencias.at(-1);
    assert.equal(ev.hash_integridad, hash);
    assert.equal(ev.nombre_archivo, 'firewall.log');
    const d = await sesiones.consultor.get(`/api/v1/incidentes/${inc.id}/evidencias/${ev.id}/archivo`).buffer(true);
    assert.equal(d.status, 200);
    assert.equal(d.headers['x-integridad-verificada'], 'si');
    assert.equal(Buffer.compare(d.body, contenido), 0);
  });

  test('RF-012: extensión no permitida → 422', async () => {
    const r = await sesiones.analista.post(`/api/v1/incidentes/${inc.id}/evidencias`)
      .attach('archivo', Buffer.from('MZ'), 'malware.exe');
    assert.equal(r.status, 422);
    assert.equal(r.body.error.codigo, 'EXTENSION_NO_PERMITIDA');
  });

  test('RF-001: contraseña débil → 422; admin crea, cambia roles y desactiva (inactivación lógica)', async () => {
    const debil = await sesiones.admin.post('/api/v1/usuarios')
      .send({ usuario: 'debil', nombre_completo: 'Débil', contrasena: '123', roles: ['analista'] });
    assert.equal(debil.status, 422);
    const nombre = `u${crypto.randomBytes(3).toString('hex')}`;
    const c = await sesiones.admin.post('/api/v1/usuarios')
      .send({ usuario: nombre, nombre_completo: 'Nuevo Analista', contrasena: 'ClaveSegura2026', roles: ['analista'] });
    assert.equal(c.status, 201);
    const roles = await sesiones.admin.patch(`/api/v1/usuarios/${c.body.data.id}`).send({ roles: ['consultor'] });
    assert.deepEqual(roles.body.data.roles, ['consultor']);
    const off = await sesiones.admin.patch(`/api/v1/usuarios/${c.body.data.id}`).send({ activo: false });
    assert.equal(off.body.data.activo, false);
    const login = await request(app).post('/api/v1/auth/login').send({ usuario: nombre, contrasena: 'ClaveSegura2026' });
    assert.equal(login.status, 401);
  });

  test('RF-001: gestor no administra usuarios; admin no se desactiva a sí mismo', async () => {
    assert.equal((await sesiones.gestor.post('/api/v1/usuarios').send({})).status, 403);
    const r = await sesiones.admin.patch(`/api/v1/usuarios/${ids.admin}`).send({ activo: false });
    assert.equal(r.status, 409);
  });

  test('RF-060: resumen con totales coherentes; analista sin acceso', async () => {
    const r = await sesiones.consultor.get('/api/v1/reportes/resumen');
    assert.equal(r.status, 200);
    const suma = r.body.data.por_estado.reduce((s, e) => s + e.total, 0);
    assert.equal(suma, r.body.data.total);
    assert.equal(r.body.data.registrados_ultimos_30_dias.length, 30);
    assert.equal((await sesiones.analista.get('/api/v1/reportes/resumen')).status, 403);
  });

  test('RF-070: auditoría solo para administrador', async () => {
    assert.equal((await sesiones.gestor.get('/api/v1/auditoria')).status, 403);
    const r = await sesiones.admin.get('/api/v1/auditoria');
    assert.equal(r.status, 200);
    assert.ok(r.body.meta.total > 0);
  });

  test('errores: JSON inválido → 400, ruta inexistente → 404, formato único', async () => {
    const j = await sesiones.gestor.post('/api/v1/incidentes').set('Content-Type', 'application/json').send('{malo');
    assert.equal(j.status, 400);
    assert.equal(j.body.error.codigo, 'JSON_INVALIDO');
    const n = await sesiones.gestor.get('/api/v1/no-existe');
    assert.equal(n.status, 404);
    assert.ok(n.body.error.codigo);
  });
});
