const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('../node_modules/supertest');

const { createApp } = require('../src/app');

test('GET /api/inventory/alerts forwards query params and preserves upstream payload', async () => {
  const calls = [];
  const app = createApp({
    fetchImpl: async (url) => {
      calls.push(url.toString());

      return {
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        async text() {
          return JSON.stringify({
            data: [{ id: 'low-stock:product-1', type: 'low-stock', productId: 'product-1' }],
            meta: { generatedAt: '2026-04-25T00:00:00.000Z', filters: { type: ['low-stock'], categoryId: 'cat-1' } }
          });
        }
      };
    }
  });

  const response = await request(app)
    .get('/api/inventory/alerts')
    .query({ type: 'low-stock', categoryId: 'cat-1' });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/inventory\/alerts\?type=low-stock&categoryId=cat-1$/);
  assert.deepEqual(response.body.data, [{ id: 'low-stock:product-1', type: 'low-stock', productId: 'product-1' }]);
});

test('GET /api/inventory/alerts preserves upstream status and body for validation errors', async () => {
  const app = createApp({
    fetchImpl: async () => ({
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      async text() {
        return JSON.stringify({ error: 'Invalid alert type filter' });
      }
    })
  });

  const response = await request(app)
    .get('/api/inventory/alerts')
    .query({ type: 'unknown' });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'Invalid alert type filter' });
});

test('GET /api/inventory/alerts returns 502 when inventory-service is unavailable', async () => {
  const app = createApp({
    fetchImpl: async () => {
      throw new Error('connect ECONNREFUSED');
    }
  });

  const response = await request(app).get('/api/inventory/alerts');

  assert.equal(response.status, 502);
  assert.deepEqual(response.body, { error: 'Inventory service unavailable' });
});
