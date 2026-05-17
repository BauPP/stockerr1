'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

/**
 * Crea un fetch simulado que rechaza con un error de red específico.
 *
 * @param {string} causeCode  El código de error (ECONNREFUSED, ENOTFOUND, ETIMEDOUT)
 * @returns {Function} fetchImpl que siempre falla
 */
function createFailingFetch(causeCode) {
  return async function failingFetch() {
    const error = Object.assign(new Error(`Simulated ${causeCode}`), {
      cause: { code: causeCode, errno: -1 },
    });
    throw error;
  };
}

/**
 * Crea un fetch simulado que responde con un status HTTP específico.
 * Se usa para probar que los códigos de error del upstream se propagan.
 *
 * @param {number} status  Código HTTP a devolver
 * @param {object} body    Cuerpo de la respuesta
 * @returns {Function} fetchImpl
 */
function createRespondingFetch(status, body = {}) {
  return async function respondingFetch() {
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
      headers: { get: () => 'application/json' },
    };
  };
}

// ---------------------------------------------------------------------------
// Helpers mock de authMiddleware para rutas protegidas
// ---------------------------------------------------------------------------
const validAuthUser = { id_usuario: 1, rol: 'Administrador', nombre: 'Admin' };
const authMiddleware = (req, _res, next) => {
  req.authUser = validAuthUser;
  next();
};

// ---------------------------------------------------------------------------
// Escenarios de error de red (ECONNREFUSED → 502, ETIMEDOUT → 504)
// ---------------------------------------------------------------------------

test('GET /api/users retorna 502 cuando user-service rechaza conexion', async () => {
  const app = createApp({
    authMiddleware,
    fetchImpl: createFailingFetch('ECONNREFUSED'),
  });
  const res = await request(app).get('/api/users');
  assert.equal(res.status, 502);
  assert.equal(res.body.error.code, 'UPSTREAM_UNAVAILABLE');
});

test('GET /api/products retorna 502 cuando product-service no responde', async () => {
  const app = createApp({
    authMiddleware,
    fetchImpl: createFailingFetch('ECONNREFUSED'),
  });
  const res = await request(app).get('/api/products');
  assert.equal(res.status, 502);
  assert.equal(res.body.error.code, 'UPSTREAM_UNAVAILABLE');
});

test('GET /api/categories retorna 502 cuando category-service esta caido', async () => {
  const app = createApp({
    authMiddleware,
    fetchImpl: createFailingFetch('ENOTFOUND'),
  });
  const res = await request(app).get('/api/categories');
  assert.equal(res.status, 502);
  assert.equal(res.body.error.code, 'UPSTREAM_UNAVAILABLE');
});

test('POST /api/auth/login retorna 502 cuando auth-service rechaza conexion', async () => {
  const app = createApp({
    fetchImpl: createFailingFetch('ECONNREFUSED'),
  });
  const res = await request(app).post('/api/auth/login').send({ correo: 'admin', contrasena: 'x' });
  assert.equal(res.status, 502);
  assert.equal(res.body.error.code, 'UPSTREAM_UNAVAILABLE');
});

test('GET /api/config retorna 502 cuando config-service esta caido', async () => {
  const app = createApp({
    authMiddleware,
    fetchImpl: createFailingFetch('ECONNREFUSED'),
  });
  const res = await request(app).get('/api/config');
  assert.equal(res.status, 502);
  assert.equal(res.body.error.code, 'UPSTREAM_UNAVAILABLE');
});

test('GET /api/products retorna 504 cuando product-service excede timeout', async () => {
  const app = createApp({
    authMiddleware,
    fetchImpl: createFailingFetch('ETIMEDOUT'),
  });
  const res = await request(app).get('/api/products');
  assert.equal(res.status, 504);
  assert.equal(res.body.error.code, 'UPSTREAM_TIMEOUT');
});

// ---------------------------------------------------------------------------
// Propagación de códigos del upstream (errores HTTP normales)
// ---------------------------------------------------------------------------

test('GET /api/users propaga 404 del user-service', async () => {
  const app = createApp({
    authMiddleware,
    fetchImpl: createRespondingFetch(404, { success: false, error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' } }),
  });
  const res = await request(app).get('/api/users/999');
  assert.equal(res.status, 404);
});

test('GET /api/products propaga 400 del product-service', async () => {
  const app = createApp({
    authMiddleware,
    fetchImpl: createRespondingFetch(400, { success: false, error: { code: 'VALIDATION_ERROR', message: 'Datos invalidos' } }),
  });
  const res = await request(app).get('/api/products');
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Supplier 501 (permanece ruta pero responde 501)
// ---------------------------------------------------------------------------

test('GET /api/suppliers retorna 501 Not Implemented', async () => {
  const app = createApp({ authMiddleware });
  const res = await request(app).get('/api/suppliers');
  assert.equal(res.status, 501);
  assert.match(res.body.error.message, /MS-10|no implementado/i);
});

// ---------------------------------------------------------------------------
// Ruta que no existe → 404 del gateway
// ---------------------------------------------------------------------------

test('Ruta inexistente retorna 404', async () => {
  const app = createApp({ authMiddleware });
  const res = await request(app).get('/api/nonexistent');
  assert.equal(res.status, 404);
});
