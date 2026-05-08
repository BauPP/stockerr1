const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { InMemoryBarcodeRepository } = require('../src/repositories/barcode.repository');

function buildTestContext() {
  const repository = new InMemoryBarcodeRepository({
    products: [
      {
        id_producto: 1,
        id_categoria: 1,
        nombre: 'Agua Mineral 500ml',
        codigo_barras_unico: '1234567890128',
        precio_compra: 10,
        precio_venta: 15,
        stock_actual: 20,
        stock_minimo: 2,
        stock_maximo: 50,
        ubicacion: 'Pasillo A',
        estado: true,
      },
      {
        id_producto: 2,
        id_categoria: 2,
        nombre: 'Papas Clásicas',
        codigo_barras_unico: '7501234567891',
        precio_compra: 8,
        precio_venta: 12,
        stock_actual: 5,
        stock_minimo: 1,
        estado: true,
      },
    ],
  });

  const app = createApp({ repository });

  return { app, repository };
}

test('GET /api/barcodes/:code — existing barcode returns product data', async () => {
  const { app } = buildTestContext();

  const response = await request(app).get('/api/barcodes/1234567890128');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.id_producto, 1);
  assert.equal(response.body.data.nombre, 'Agua Mineral 500ml');
  assert.equal(response.body.data.codigo_barras, '1234567890128');
});

test('GET /api/barcodes/:code — nonexistent barcode returns 404', async () => {
  const { app } = buildTestContext();

  const response = await request(app).get('/api/barcodes/9999999999999');

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'BARCODE_NOT_FOUND');
});

test('GET /api/barcodes/:code — invalid format returns 400', async () => {
  const { app } = buildTestContext();

  const response = await request(app).get('/api/barcodes/ABC123');

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'INVALID_BARCODE_FORMAT');
});

test('POST /api/barcodes/validate — valid EAN-13 returns valid true', async () => {
  const { app } = buildTestContext();

  const response = await request(app).post('/api/barcodes/validate').send({
    code: '1234567890128',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.valid, true);
});

test('POST /api/barcodes/validate — bad checksum returns valid false', async () => {
  const { app } = buildTestContext();

  const response = await request(app).post('/api/barcodes/validate').send({
    code: '1234567890123',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.valid, false);
  assert.equal(response.body.data.message.includes('checksum'), true);
});

test('POST /api/barcodes/validate — non-numeric or wrong length returns valid false', async () => {
  const { app } = buildTestContext();

  const alphaResponse = await request(app).post('/api/barcodes/validate').send({
    code: 'ABC123',
  });

  assert.equal(alphaResponse.status, 200);
  assert.equal(alphaResponse.body.success, true);
  assert.equal(alphaResponse.body.data.valid, false);

  const shortResponse = await request(app).post('/api/barcodes/validate').send({
    code: '12345',
  });

  assert.equal(shortResponse.status, 200);
  assert.equal(shortResponse.body.success, true);
  assert.equal(shortResponse.body.data.valid, false);
});

test('POST /api/barcodes/generate — returns valid unique EAN-13 code', async () => {
  const { app } = buildTestContext();

  const response = await request(app).post('/api/barcodes/generate').send({});

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(response.body.data.code, 'should have a code property');
  assert.equal(response.body.data.code.length, 13);
  assert.ok(/^\d{13}$/.test(response.body.data.code));

  // Validate checksum of generated code
  const digits = response.body.data.code.split('').map(Number);
  const sumOdd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8] + digits[10];
  const sumEven = (digits[1] + digits[3] + digits[5] + digits[7] + digits[9] + digits[11]) * 3;
  const checksum = (10 - ((sumOdd + sumEven) % 10)) % 10;
  assert.equal(digits[12], checksum, 'generated code must have valid EAN-13 checksum');

  // Generated code should not exist in repository
  const existing = await app.get('repository').getProductByBarcode(response.body.data.code);
  assert.equal(existing, null);
});

test('POST /api/barcodes/generate — collision retry works up to 10 attempts', async () => {
  const { app, repository } = buildTestContext();

  // Force collisions by seeding the repository with a code that would be generated
  // We need to intercept the generate to understand what codes will be generated
  // Instead, use a repository that returns a specific code on first check, then none
  const collisionRepository = new InMemoryBarcodeRepository({
    products: [
      {
        id_producto: 1,
        id_categoria: 1,
        nombre: 'Test',
        codigo_barras_unico: '0000000000000',
        precio_compra: 10,
        precio_venta: 15,
        stock_actual: 1,
        estado: true,
      },
    ],
  });
  let callCount = 0;
  const originalGet = collisionRepository.getProductByBarcode.bind(collisionRepository);
  collisionRepository.getProductByBarcode = async (code) => {
    callCount++;
    // First call returns a product (collision), subsequent calls return null
    if (callCount === 1) {
      return { id_producto: 1, nombre: 'Test', codigo_barras_unico: code };
    }
    return null;
  };

  const collisionApp = createApp({ repository: collisionRepository });

  const response = await request(collisionApp).post('/api/barcodes/generate').send({});

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(response.body.data.code);
  assert.equal(response.body.data.code.length, 13);
  assert.ok(callCount >= 2, 'should have retried at least once after collision');
});

test('POST /api/barcodes/generate — with prefix uses it correctly', async () => {
  const { app } = buildTestContext();

  const response = await request(app).post('/api/barcodes/generate').send({
    prefix: '750',
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(response.body.data.code);
  assert.equal(response.body.data.code.length, 13);
  assert.ok(response.body.data.code.startsWith('750'), 'code should start with the given prefix');
});
