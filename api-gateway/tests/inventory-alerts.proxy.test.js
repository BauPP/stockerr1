'use strict';

/**
 * Test del proxy de alertas de stock (MS-06) en el API Gateway.
 *
 * Este test ejerce el router de inventario en aislamiento, sin el authMiddleware
 * ni el auth-service detrás. Solo nos interesa verificar el comportamiento del
 * proxy: que reenvía query params, que conserva status y body del upstream, y
 * que devuelve 502 cuando el inventory-service no responde.
 *
 * La cobertura de auth + role gating sobre /alerts vive en el test de
 * integración completo (gateway-full.integration.test.js), donde se levanta
 * un auth-service real y se valida el JWT.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const { createInventoryRouter } = require('../src/routes/inventory.routes');

function buildAppWith(fetchImpl) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/inventory',
    createInventoryRouter({
      inventoryServiceUrl: 'http://inventory-upstream:3005',
      fetchImpl,
      // Sin authMiddleware → legacy mode: sirve para aislar el comportamiento
      // del proxy. El test de integración full cubre la parte de auth.
    })
  );
  return app;
}

test('GET /api/inventory/alerts forwards query params and preserves upstream payload', async () => {
  const calls = [];
  const app = buildAppWith(async (url) => {
    calls.push(url.toString());
    return {
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      async text() {
        return JSON.stringify({
          data: [{ id: 'low-stock:product-1', type: 'low-stock', productId: 'product-1' }],
          meta: {
            generatedAt: '2026-04-25T00:00:00.000Z',
            filters: { type: ['low-stock'], categoryId: 'cat-1' },
          },
        });
      },
    };
  });

  const response = await request(app)
    .get('/api/inventory/alerts')
    .query({ type: 'low-stock', categoryId: 'cat-1' });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/inventory\/alerts/);
  assert.match(calls[0], /type=low-stock/);
  assert.match(calls[0], /categoryId=cat-1/);
  assert.deepEqual(response.body.data, [
    { id: 'low-stock:product-1', type: 'low-stock', productId: 'product-1' },
  ]);
});

test('GET /api/inventory/alerts preserves upstream status and body for validation errors', async () => {
  const app = buildAppWith(async () => ({
    status: 400,
    headers: new Headers({ 'content-type': 'application/json' }),
    async text() {
      return JSON.stringify({ error: 'Invalid alert type filter' });
    },
  }));

  const response = await request(app)
    .get('/api/inventory/alerts')
    .query({ type: 'unknown' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Invalid alert type filter');
});

test('GET /api/inventory/alerts returns 502 when inventory-service is unavailable', async () => {
  const app = buildAppWith(async () => {
    throw new Error('connect ECONNREFUSED');
  });

  const response = await request(app).get('/api/inventory/alerts');

  assert.equal(response.status, 502);
  assert.equal(response.body.error, 'Inventory service unavailable');
});
