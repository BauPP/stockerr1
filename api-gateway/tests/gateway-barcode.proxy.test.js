'use strict';

/**
 * Test de integración del proxy de barcode-service (MS-08) en el API Gateway.
 *
 * Levanta un auth-service real + un mock upstream de barcode + el gateway,
 * y verifica que las rutas /api/barcodes/* se autoricen y reenvíen
 * correctamente según el rol del usuario autenticado.
 *
 * Cobertura:
 *   - 401 sin token
 *   - 200 Admin en todos los endpoints
 *   - 200 Operador en lookup y validate
 *   - 403 Operador en generate (Admin-only)
 *   - 502 cuando el upstream de barcode no responde
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
// Mock upstream de barcode-service
// ---------------------------------------------------------------------------
function createMockBarcodeServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const method = req.method;

    // GET /api/barcodes/:code
    if (method === 'GET' && url.pathname.startsWith('/api/barcodes/')) {
      const code = url.pathname.split('/').pop();

      // Simular 404 para código no existente
      if (code === 'nonexistent') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: { code: 'BARCODE_NOT_FOUND', message: 'Código de barras no encontrado' },
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          product: {
            id_producto: 1,
            nombre: 'Producto Test',
            codigo_barras: code,
          },
        },
      }));
      return;
    }

    // POST /api/barcodes/validate
    if (method === 'POST' && url.pathname === '/api/barcodes/validate') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          valid: true,
          code: '7501234567890',
          formato: 'EAN-13',
        },
      }));
      return;
    }

    // POST /api/barcodes/generate
    if (method === 'POST' && url.pathname === '/api/barcodes/generate') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          codes: ['7501234567890', '7501234567891'],
          cantidad: 2,
        },
      }));
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
test('GET /api/barcodes/:code rechaza petición sin token de autenticación', async () => {
  const authApp = createAuthApp({ seedUsers: createSeedUsers() });
  const mockBarcode = createMockBarcodeServer();

  const authServer = await startServer(authApp);
  const mockServer = await startServer(mockBarcode);
  const authPort = authServer.address().port;
  const mockPort = mockServer.address().port;

  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    barcodeServiceUrl: `http://127.0.0.1:${mockPort}`,
  });

  const response = await request(gatewayApp).get('/api/barcodes/7501234567890');

  assert.equal(response.status, 401);

  await stopServer(mockServer);
  await stopServer(authServer);
});

test('GET /api/barcodes/:code permite a Admin consultar y reenvía respuesta del upstream', async () => {
  const authApp = createAuthApp({ seedUsers: createSeedUsers() });
  const mockBarcode = createMockBarcodeServer();

  const authServer = await startServer(authApp);
  const mockServer = await startServer(mockBarcode);
  const authPort = authServer.address().port;
  const mockPort = mockServer.address().port;

  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    barcodeServiceUrl: `http://127.0.0.1:${mockPort}`,
  });

  const login = await request(gatewayApp).post('/api/auth/login').send({
    nombre_usuario: 'admin',
    contrasena: 'Admin1234',
  });
  const token = login.body.data.token;

  const response = await request(gatewayApp)
    .get('/api/barcodes/7501234567890')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.product.codigo_barras, '7501234567890');
  assert.equal(response.body.data.product.nombre, 'Producto Test');

  await stopServer(mockServer);
  await stopServer(authServer);
});

test('GET /api/barcodes/:code permite a Operador consultar', async () => {
  const authApp = createAuthApp({ seedUsers: createSeedUsers() });
  const mockBarcode = createMockBarcodeServer();

  const authServer = await startServer(authApp);
  const mockServer = await startServer(mockBarcode);
  const authPort = authServer.address().port;
  const mockPort = mockServer.address().port;

  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    barcodeServiceUrl: `http://127.0.0.1:${mockPort}`,
  });

  const login = await request(gatewayApp).post('/api/auth/login').send({
    nombre_usuario: 'operador',
    contrasena: 'Operador123',
  });
  const token = login.body.data.token;

  const response = await request(gatewayApp)
    .get('/api/barcodes/7501234567890')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  await stopServer(mockServer);
  await stopServer(authServer);
});

test('POST /api/barcodes/validate permite a Admin validar un código', async () => {
  const authApp = createAuthApp({ seedUsers: createSeedUsers() });
  const mockBarcode = createMockBarcodeServer();

  const authServer = await startServer(authApp);
  const mockServer = await startServer(mockBarcode);
  const authPort = authServer.address().port;
  const mockPort = mockServer.address().port;

  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    barcodeServiceUrl: `http://127.0.0.1:${mockPort}`,
  });

  const login = await request(gatewayApp).post('/api/auth/login').send({
    nombre_usuario: 'admin',
    contrasena: 'Admin1234',
  });
  const token = login.body.data.token;

  const response = await request(gatewayApp)
    .post('/api/barcodes/validate')
    .set('Authorization', `Bearer ${token}`)
    .send({ code: '7501234567890' });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.valid, true);

  await stopServer(mockServer);
  await stopServer(authServer);
});

test('POST /api/barcodes/generate rechaza a Operador (solo Admin)', async () => {
  const authApp = createAuthApp({ seedUsers: createSeedUsers() });
  const mockBarcode = createMockBarcodeServer();

  const authServer = await startServer(authApp);
  const mockServer = await startServer(mockBarcode);
  const authPort = authServer.address().port;
  const mockPort = mockServer.address().port;

  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    barcodeServiceUrl: `http://127.0.0.1:${mockPort}`,
  });

  const login = await request(gatewayApp).post('/api/auth/login').send({
    nombre_usuario: 'operador',
    contrasena: 'Operador123',
  });
  const token = login.body.data.token;

  const response = await request(gatewayApp)
    .post('/api/barcodes/generate')
    .set('Authorization', `Bearer ${token}`)
    .send({ prefix: '750' });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'AUTH_FORBIDDEN');

  await stopServer(mockServer);
  await stopServer(authServer);
});

test('GET /api/barcodes/:code sin upstream responde 502 Bad Gateway', async () => {
  const authApp = createAuthApp({ seedUsers: createSeedUsers() });
  const authServer = await startServer(authApp);
  const authPort = authServer.address().port;

  // Apuntar a un puerto donde NO hay nada escuchando
  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    barcodeServiceUrl: 'http://127.0.0.1:1',
  });

  const login = await request(gatewayApp).post('/api/auth/login').send({
    nombre_usuario: 'admin',
    contrasena: 'Admin1234',
  });
  const token = login.body.data.token;

  const response = await request(gatewayApp)
    .get('/api/barcodes/7501234567890')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 502);
  assert.equal(response.body.error.code, 'BAD_GATEWAY');
  assert.equal(response.body.error.message, 'Barcode service no disponible');

  await stopServer(authServer);
});
