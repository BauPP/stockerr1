'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp: createConfigApp } = require('../../services/config-service/src/app');
const {
  InMemoryConfigRepository,
} = require('../../services/config-service/src/repositories/config.repository');
const { createApp: createGatewayApp } = require('../src/app');

async function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) return reject(error);
      return resolve();
    });
  });
}

function buildConfigService() {
  const repository = new InMemoryConfigRepository({
    configs: {
      stock_minimo_global: '10',
      max_intentos_login: '3',
    },
  });

  const app = createConfigApp({
    repository,
    verifyJWT: (req, _res, next) => {
      req.authUser = { id_usuario: 1, rol: 'Administrador', nombre: 'Admin' };
      next();
    },
  });

  return { app, repository };
}

test('GET /api/config retorna config desde gateway como Admin', async () => {
  const configService = buildConfigService();
  const configServer = await startServer(configService.app);
  const configPort = configServer.address().port;

  const gatewayApp = createGatewayApp({
    configServiceUrl: `http://127.0.0.1:${configPort}`,
    authMiddleware: (req, _res, next) => {
      req.authUser = { id_usuario: 1, rol: 'Administrador', nombre: 'Admin' };
      next();
    },
  });

  const response = await request(gatewayApp)
    .get('/api/config')
    .set('Authorization', 'Bearer fake-token');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.stock_minimo_global, '10');
  assert.equal(response.body.data.max_intentos_login, '3');

  await stopServer(configServer);
});

test('PUT /api/config actualiza config desde gateway como Admin', async () => {
  const configService = buildConfigService();
  const configServer = await startServer(configService.app);
  const configPort = configServer.address().port;

  const gatewayApp = createGatewayApp({
    configServiceUrl: `http://127.0.0.1:${configPort}`,
    authMiddleware: (req, _res, next) => {
      req.authUser = { id_usuario: 1, rol: 'Administrador', nombre: 'Admin' };
      next();
    },
  });

  const response = await request(gatewayApp)
    .put('/api/config')
    .set('Authorization', 'Bearer fake-token')
    .send({ stock_minimo_global: '99' });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data.updated, ['stock_minimo_global']);

  await stopServer(configServer);
});

test('PUT /api/config rechaza Operador con 403', async () => {
  const configService = buildConfigService();
  const configServer = await startServer(configService.app);
  const configPort = configServer.address().port;

  const gatewayApp = createGatewayApp({
    configServiceUrl: `http://127.0.0.1:${configPort}`,
    authMiddleware: (req, _res, next) => {
      req.authUser = { id_usuario: 2, rol: 'Operador', nombre: 'Operador' };
      next();
    },
  });

  const response = await request(gatewayApp)
    .put('/api/config')
    .set('Authorization', 'Bearer fake-token')
    .send({ stock_minimo_global: '99' });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'AUTH_FORBIDDEN');

  await stopServer(configServer);
});

test('GET /api/config permite Operador leer con 200', async () => {
  const configService = buildConfigService();
  const configServer = await startServer(configService.app);
  const configPort = configServer.address().port;

  const gatewayApp = createGatewayApp({
    configServiceUrl: `http://127.0.0.1:${configPort}`,
    authMiddleware: (req, _res, next) => {
      req.authUser = { id_usuario: 2, rol: 'Operador', nombre: 'Operador' };
      next();
    },
  });

  const response = await request(gatewayApp)
    .get('/api/config')
    .set('Authorization', 'Bearer fake-token');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  await stopServer(configServer);
});
