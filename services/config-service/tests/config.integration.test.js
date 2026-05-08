const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { InMemoryConfigRepository } = require('../src/repositories/config.repository');

/**
 * Mock auth middleware for testing.
 * Accepts Bearer tokens: 'admin-token' → Admin role, 'operator-token' → Operador role.
 */
function testAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_TOKEN_MISSING', message: 'Token requerido' },
    });
  }
  const token = auth.slice(7);
  if (token === 'admin-token') {
    req.authUser = { id_usuario: 1, rol: 'Admin' };
    return next();
  }
  if (token === 'operator-token') {
    req.authUser = { id_usuario: 2, rol: 'Operador' };
    return next();
  }
  return res.status(401).json({
    success: false,
    error: { code: 'AUTH_TOKEN_INVALID', message: 'Token inválido' },
  });
}

/**
 * Mock admin-only guard.
 */
function testAdminOnly(req, res, next) {
  if (req.authUser?.rol !== 'Admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'AUTH_FORBIDDEN', message: 'No tiene permisos para esta operación' },
    });
  }
  next();
}

function buildTestContext() {
  const repository = new InMemoryConfigRepository({
    dias_expiracion_alertas: '30',
    max_intentos_login: '3',
    tiempo_bloqueo_minutos: '15',
  });

  const app = createApp({
    repository,
    authMiddleware: testAuth,
    adminOnly: testAdminOnly,
  });

  return { app, repository };
}

test('GET /api/config — returns all configured params with defaults for missing', async () => {
  const { app } = buildTestContext();

  const response = await request(app).get('/api/config');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  // DB values
  assert.equal(response.body.data.dias_expiracion_alertas, '30');
  assert.equal(response.body.data.max_intentos_login, '3');
  assert.equal(response.body.data.tiempo_bloqueo_minutos, '15');
  // Default value (not in DB seed)
  assert.equal(response.body.data.stock_minimo_global, '10');
});

test('GET /api/config/:key — returns single param from DB', async () => {
  const { app } = buildTestContext();

  const response = await request(app).get('/api/config/dias_expiracion_alertas');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.clave, 'dias_expiracion_alertas');
  assert.equal(response.body.data.valor, '30');
  assert.equal(response.body.data.configurado, true);
});

test('GET /api/config/:key — nonexistent key returns default with configurado false', async () => {
  const { app } = buildTestContext();

  const response = await request(app).get('/api/config/stock_minimo_global');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.clave, 'stock_minimo_global');
  assert.equal(response.body.data.valor, '10');
  assert.equal(response.body.data.configurado, false);
});

test('GET /api/config/:key — unknown key returns empty value with configurado false', async () => {
  const { app } = buildTestContext();

  const response = await request(app).get('/api/config/unknown_key');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.clave, 'unknown_key');
  assert.equal(response.body.data.valor, '');
  assert.equal(response.body.data.configurado, false);
});

test('PUT /api/config/:key — creates new config param', async () => {
  const { app, repository } = buildTestContext();

  const response = await request(app)
    .put('/api/config/nuevo_parametro')
    .set('Authorization', 'Bearer admin-token')
    .send({ value: '42' });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.clave, 'nuevo_parametro');
  assert.equal(response.body.data.valor_nuevo, '42');
  assert.equal(response.body.data.valor_anterior, null);

  // Verify persisted in repository
  const saved = await repository.getByKey('nuevo_parametro');
  assert.notEqual(saved, null);
  assert.equal(saved.valor, '42');
});

test('PUT /api/config/:key — updates existing param and returns old value', async () => {
  const { app, repository } = buildTestContext();

  const response = await request(app)
    .put('/api/config/dias_expiracion_alertas')
    .set('Authorization', 'Bearer admin-token')
    .send({ value: '45' });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.clave, 'dias_expiracion_alertas');
  assert.equal(response.body.data.valor_nuevo, '45');
  assert.equal(response.body.data.valor_anterior, '30');

  // Verify persisted in repository
  const saved = await repository.getByKey('dias_expiracion_alertas');
  assert.equal(saved.valor, '45');
});

test('PUT /api/config/:key — invalid key format returns 400', async () => {
  const { app } = buildTestContext();

  const response = await request(app)
    .put('/api/config/invalid-key!')
    .set('Authorization', 'Bearer admin-token')
    .send({ value: 'test' });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('PUT /api/config/:key — auth required returns 401 if no token', async () => {
  const { app } = buildTestContext();

  const response = await request(app)
    .put('/api/config/dias_expiracion_alertas')
    .send({ value: '45' });

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'AUTH_TOKEN_MISSING');
});

test('PUT /api/config/:key — non-admin role returns 403', async () => {
  const { app } = buildTestContext();

  const response = await request(app)
    .put('/api/config/dias_expiracion_alertas')
    .set('Authorization', 'Bearer operator-token')
    .send({ value: '45' });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'AUTH_FORBIDDEN');
});

test('PUT /api/config/:key — empty value returns 400', async () => {
  const { app } = buildTestContext();

  const response = await request(app)
    .put('/api/config/dias_expiracion_alertas')
    .set('Authorization', 'Bearer admin-token')
    .send({ value: '' });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});
