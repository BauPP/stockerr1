'use strict';

/**
 * Test de integración del proxy de config-service (MS-11) en el API Gateway.
 *
 * Levanta un auth-service real + un mock upstream de config + el gateway,
 * y verifica que las rutas /api/config/* se autoricen y reenvíen
 * correctamente según el rol del usuario autenticado.
 *
 * Cobertura:
 *   - 401 sin token
 *   - 200 Admin en GET y PUT
 *   - 200 Operador en GET
 *   - 403 Operador en PUT (Admin-only)
 *   - 502 cuando el upstream de config no responde
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const bcrypt = require('bcryptjs');
const request = require('supertest');

const { createApp: createAuthApp } = require('../../services/auth-service/src/app');
const { createApp: createGatewayApp } = require('../src/app');

// ---------------------------------------------------------------------------
// Helpers para levantar/parar servidores en puertos aleatorios
// ---------------------------------------------------------------------------
function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) return reject(error);
      return resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Seed de usuarios para auth-service
// ---------------------------------------------------------------------------
function createSeedUsers() {
  return [
    {
      id_usuario: 1,
      nombre_usuario: 'admin',
      nombre: 'Administrador',
      rol: 'Administrador',
      estado: 'activo',
      contrasena_hash: bcrypt.hashSync('Admin1234', 10),
      intentos_fallidos: 0,
      bloqueo_hasta: null,
    },
    {
      id_usuario: 2,
      nombre_usuario: 'operador',
      nombre: 'Operador',
      rol: 'Operador',
      estado: 'activo',
      contrasena_hash: bcrypt.hashSync('Operador123', 10),
      intentos_fallidos: 0,
      bloqueo_hasta: null,
    },
  ];
}

// ---------------------------------------------------------------------------
// Mock upstream de config-service
// Responde con el mismo formato que el config-service real:
//   GET /api/config             → { success: true, data: { <key>: <val>, ... } }
//   GET /api/config/:key        → { success: true, data: { clave, valor, configurado } }
//   PUT /api/config/:key        → { success: true, data: { clave, valor_anterior, valor_nuevo } }
// ---------------------------------------------------------------------------
function createMockConfigServer() {
  // Estado interno del mock (simula la BD)
  const store = {
    dias_expiracion_alertas: '30',
    max_intentos_login: '3',
    tiempo_bloqueo_minutos: '15',
  };

  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const method = req.method;

    // GET /api/config — todos los parámetros
    if (method === 'GET' && url.pathname === '/api/config') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: { ...store },
      }));
      return;
    }

    // GET /api/config/:key — un parámetro específico
    const getMatch = url.pathname.match(/^\/api\/config\/(.+)$/);
    if (method === 'GET' && getMatch) {
      const key = getMatch[1];
      if (key in store) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: { clave: key, valor: store[key], configurado: true },
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: { clave: key, valor: '', configurado: false },
        }));
      }
      return;
    }

    // PUT /api/config/:key — actualizar
    const putMatch = url.pathname.match(/^\/api\/config\/(.+)$/);
    if (method === 'PUT' && putMatch) {
      const key = putMatch[1];
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        const parsed = JSON.parse(body || '{}');
        const oldValue = store[key] || null;
        store[key] = parsed.value || '';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          data: {
            clave: key,
            valor_anterior: oldValue,
            valor_nuevo: store[key],
          },
        }));
      });
      return;
    }

    // Cualquier otra ruta → 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } }));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test('GET /api/config rechaza petición sin token de autenticación', async () => {
  const authApp = createAuthApp({ seedUsers: createSeedUsers() });
  const mockConfig = createMockConfigServer();

  const authServer = await startServer(authApp);
  const mockServer = await startServer(mockConfig);
  const authPort = authServer.address().port;
  const mockPort = mockServer.address().port;

  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    configServiceUrl: `http://127.0.0.1:${mockPort}`,
  });

  const response = await request(gatewayApp).get('/api/config');

  assert.equal(response.status, 401);

  await stopServer(mockServer);
  await stopServer(authServer);
});

test('GET /api/config permite a Admin listar todos los parámetros', async () => {
  const authApp = createAuthApp({ seedUsers: createSeedUsers() });
  const mockConfig = createMockConfigServer();

  const authServer = await startServer(authApp);
  const mockServer = await startServer(mockConfig);
  const authPort = authServer.address().port;
  const mockPort = mockServer.address().port;

  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    configServiceUrl: `http://127.0.0.1:${mockPort}`,
  });

  const login = await request(gatewayApp).post('/api/auth/login').send({
    nombre_usuario: 'admin',
    contrasena: 'Admin1234',
  });
  const token = login.body.data.token;

  const response = await request(gatewayApp)
    .get('/api/config')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.dias_expiracion_alertas, '30');
  assert.equal(response.body.data.max_intentos_login, '3');

  await stopServer(mockServer);
  await stopServer(authServer);
});

test('GET /api/config/:key permite a Operador consultar un parámetro específico', async () => {
  const authApp = createAuthApp({ seedUsers: createSeedUsers() });
  const mockConfig = createMockConfigServer();

  const authServer = await startServer(authApp);
  const mockServer = await startServer(mockConfig);
  const authPort = authServer.address().port;
  const mockPort = mockServer.address().port;

  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    configServiceUrl: `http://127.0.0.1:${mockPort}`,
  });

  const login = await request(gatewayApp).post('/api/auth/login').send({
    nombre_usuario: 'operador',
    contrasena: 'Operador123',
  });
  const token = login.body.data.token;

  const response = await request(gatewayApp)
    .get('/api/config/dias_expiracion_alertas')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.clave, 'dias_expiracion_alertas');
  assert.equal(response.body.data.valor, '30');

  await stopServer(mockServer);
  await stopServer(authServer);
});

test('PUT /api/config/:key permite a Admin actualizar un parámetro', async () => {
  const authApp = createAuthApp({ seedUsers: createSeedUsers() });
  const mockConfig = createMockConfigServer();

  const authServer = await startServer(authApp);
  const mockServer = await startServer(mockConfig);
  const authPort = authServer.address().port;
  const mockPort = mockServer.address().port;

  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    configServiceUrl: `http://127.0.0.1:${mockPort}`,
  });

  const login = await request(gatewayApp).post('/api/auth/login').send({
    nombre_usuario: 'admin',
    contrasena: 'Admin1234',
  });
  const token = login.body.data.token;

  const response = await request(gatewayApp)
    .put('/api/config/dias_expiracion_alertas')
    .set('Authorization', `Bearer ${token}`)
    .send({ value: '60' });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.clave, 'dias_expiracion_alertas');
  assert.equal(response.body.data.valor_anterior, '30');
  assert.equal(response.body.data.valor_nuevo, '60');

  await stopServer(mockServer);
  await stopServer(authServer);
});

test('PUT /api/config/:key rechaza a Operador (solo Admin)', async () => {
  const authApp = createAuthApp({ seedUsers: createSeedUsers() });
  const mockConfig = createMockConfigServer();

  const authServer = await startServer(authApp);
  const mockServer = await startServer(mockConfig);
  const authPort = authServer.address().port;
  const mockPort = mockServer.address().port;

  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    configServiceUrl: `http://127.0.0.1:${mockPort}`,
  });

  const login = await request(gatewayApp).post('/api/auth/login').send({
    nombre_usuario: 'operador',
    contrasena: 'Operador123',
  });
  const token = login.body.data.token;

  const response = await request(gatewayApp)
    .put('/api/config/dias_expiracion_alertas')
    .set('Authorization', `Bearer ${token}`)
    .send({ value: '60' });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'AUTH_FORBIDDEN');

  await stopServer(mockServer);
  await stopServer(authServer);
});

test('GET /api/config sin upstream responde 502 Bad Gateway', async () => {
  const authApp = createAuthApp({ seedUsers: createSeedUsers() });
  const authServer = await startServer(authApp);
  const authPort = authServer.address().port;

  // Apuntar a un puerto donde NO hay nada escuchando
  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    configServiceUrl: 'http://127.0.0.1:1',
  });

  const login = await request(gatewayApp).post('/api/auth/login').send({
    nombre_usuario: 'admin',
    contrasena: 'Admin1234',
  });
  const token = login.body.data.token;

  const response = await request(gatewayApp)
    .get('/api/config')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 502);
  assert.equal(response.body.error.code, 'BAD_GATEWAY');

  await stopServer(authServer);
});
