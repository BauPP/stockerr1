'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');

function buildAdminContext() {
  const repository = createTestRepository();

  const app = createApp({
    repository,
    verifyJWT: (req, _res, next) => {
      req.authUser = { id_usuario: 1, rol: 'Administrador', nombre: 'Admin' };
      next();
    },
  });

  return { app, repository };
}

function createTestRepository() {
  const { InMemoryConfigRepository } = require('../src/repositories/config.repository');
  return new InMemoryConfigRepository({
    configs: {
      stock_minimo_global: '10',
      max_intentos_login: '3',
    },
  });
}

test('GET /api/config retorna todas las configuraciones', async () => {
  const { app } = buildAdminContext();

  const response = await request(app).get('/api/config');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.stock_minimo_global, '10');
  assert.equal(response.body.data.max_intentos_login, '3');
});

test('PUT /api/config actualiza multiples claves en bulk', async () => {
  const { app, repository } = buildAdminContext();

  const response = await request(app).put('/api/config').send({
    stock_minimo_global: '20',
    max_intentos_login: '5',
    nuevo_parametro: 'true',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data.updated.sort(), [
    'max_intentos_login',
    'nuevo_parametro',
    'stock_minimo_global',
  ]);
  assert.deepEqual(response.body.data.errors, []);

  // Verify persistence in repository
  const all = await repository.getAll();
  assert.equal(all.stock_minimo_global, '20');
  assert.equal(all.max_intentos_login, '5');
  assert.equal(all.nuevo_parametro, 'true');
});

test('PUT /api/config actualiza una sola clave', async () => {
  const { app } = buildAdminContext();

  const response = await request(app).put('/api/config').send({
    stock_minimo_global: '99',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data.updated, ['stock_minimo_global']);
  assert.deepEqual(response.body.data.errors, []);
});

test('PUT /api/config rechaza cuerpo vacio', async () => {
  const { app } = buildAdminContext();

  const response = await request(app).put('/api/config').send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'VALIDATION_ERROR');
});

test('PUT /api/config rechaza formato de clave invalido', async () => {
  const { app } = buildAdminContext();

  const response = await request(app).put('/api/config').send({
    'clave con espacios': 'valor',
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.ok(response.body.data);
  assert.equal(response.body.data.errors.length, 1);
  assert.equal(response.body.data.errors[0].clave, 'clave con espacios');
  assert.ok(response.body.data.errors[0].error);
});

test('GET /api/config rechaza 401 sin token JWT', async () => {
  const { InMemoryConfigRepository } = require('../src/repositories/config.repository');
  const repository = new InMemoryConfigRepository();
  const app = createApp({ repository, authServiceUrl: 'http://auth:3002' });

  const response = await request(app).get('/api/config');

  assert.equal(response.status, 401);
});

test('PUT /api/config rechaza 401 sin token JWT', async () => {
  const { InMemoryConfigRepository } = require('../src/repositories/config.repository');
  const repository = new InMemoryConfigRepository();
  const app = createApp({ repository, authServiceUrl: 'http://auth:3002' });

  const response = await request(app).put('/api/config').send({ stock_minimo_global: '20' });

  assert.equal(response.status, 401);
});
