const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/app');
const { InMemoryInventoryRepository } = require('../src/repositories/inventory.repository');

function createTestAuthMiddleware(user) {
  return (req, _res, next) => {
    req.authUser = user;
    next();
  };
}

function buildTestContext(
  user = { id_usuario: 10, nombre: 'Operador Demo', rol: 'Operador' }
) {
  const repository = new InMemoryInventoryRepository({
    products: [
      {
        id_producto: 1,
        nombre: 'Agua Mineral 500ml',
        stock_actual: 10,
        estado: true,
      },
      {
        id_producto: 2,
        nombre: 'Papas Clasicas',
        stock_actual: 3,
        estado: true,
      },
    ],
  });

  const app = createApp({
    repository,
    notifier: { notifyMovementRegistered: async () => {} },
    authMiddleware: createTestAuthMiddleware(user),
  });

  return { app, repository };
}

test('POST /api/inventory/movements registra una entrada y actualiza stock de forma atomica', async () => {
  const { app, repository } = buildTestContext();

  const response = await request(app).post('/api/inventory/movements').send({
    id_producto: 1,
    tipo_movimiento: 'entrada',
    cantidad: 5,
    comentario: 'Ingreso por compra',
    numero_factura: 'FAC-001',
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.stock_anterior, 10);
  assert.equal(response.body.data.nuevo_stock, 15);
  assert.equal(repository.movements.length, 1);

  const product = await repository.getProductById(1);
  assert.equal(product.stock_actual, 15);
});

test('POST /api/inventory/movements rechaza salidas que dejan stock negativo', async () => {
  const { app, repository } = buildTestContext();

  const response = await request(app).post('/api/inventory/movements').send({
    id_producto: 2,
    tipo_movimiento: 'salida',
    cantidad: 5,
    motivo: 'Venta',
  });

  assert.equal(response.status, 422);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'INSUFFICIENT_STOCK');
  assert.equal(repository.movements.length, 0);

  const product = await repository.getProductById(2);
  assert.equal(product.stock_actual, 3);
});

test('POST /api/inventory/movements bloquea ajustes para usuarios no administradores', async () => {
  const { app } = buildTestContext({
    id_usuario: 11,
    nombre: 'Operador Prueba',
    rol: 'Operador',
  });

  const response = await request(app).post('/api/inventory/movements').send({
    id_producto: 1,
    tipo_movimiento: 'ajuste',
    cantidad: 2,
    tipo_ajuste: 'faltante',
    motivo_ajuste: 'Conteo ciclico',
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'INVENTORY_ADJUSTMENT_FORBIDDEN');
});

test('POST /api/inventory/movements responde 404 si el proveedor no existe', async () => {
  const repository = new InMemoryInventoryRepository({
    products: [
      {
        id_producto: 1,
        nombre: 'Agua Mineral 500ml',
        stock_actual: 10,
        estado: true,
      },
    ],
  });
  repository.getProviderById = async () => null;

  const customApp = createApp({
    repository,
    notifier: { notifyMovementRegistered: async () => {} },
    authMiddleware: createTestAuthMiddleware({
      id_usuario: 10,
      nombre: 'Operador Demo',
      rol: 'Operador',
    }),
  });

  const response = await request(customApp).post('/api/inventory/movements').send({
    id_producto: 1,
    tipo_movimiento: 'entrada',
    cantidad: 2,
    id_proveedor: 999,
    numero_factura: 'FAC-404',
  });

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'SUPPLIER_NOT_FOUND');
});

test('GET /api/inventory/movements filtra por fecha, producto y tipo', async () => {
  const admin = { id_usuario: 1, nombre: 'Admin Demo', rol: 'Administrador' };
  const repository = new InMemoryInventoryRepository({
    products: [
      { id_producto: 1, nombre: 'Agua Mineral 500ml', stock_actual: 12, estado: true },
      { id_producto: 2, nombre: 'Papas Clasicas', stock_actual: 6, estado: true },
    ],
    movements: [
      {
        id_movimiento: 1,
        id_producto: 1,
        nombre_producto: 'Agua Mineral 500ml',
        tipo_movimiento: 'entrada',
        movement_type: 'entrada',
        cantidad: 2,
        stock_anterior: 10,
        stock_posterior: 12,
        comentarios: 'Carga inicial',
        id_usuario: admin.id_usuario,
        nombre_usuario: admin.nombre,
        fecha_hora_exacta: '2026-04-18T10:00:00.000Z',
      },
      {
        id_movimiento: 2,
        id_producto: 2,
        nombre_producto: 'Papas Clasicas',
        tipo_movimiento: 'salida',
        movement_type: 'salida',
        cantidad: 1,
        stock_anterior: 7,
        stock_posterior: 6,
        nombre_motivo: 'Venta',
        id_usuario: admin.id_usuario,
        nombre_usuario: admin.nombre,
        fecha_hora_exacta: '2026-04-17T10:00:00.000Z',
      },
    ],
  });

  const app = createApp({
    repository,
    notifier: { notifyMovementRegistered: async () => {} },
    authMiddleware: createTestAuthMiddleware(admin),
  });

  const response = await request(app).get(
    '/api/inventory/movements?producto=1&tipo=entrada&fecha=2026-04-18'
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.total, 1);
  assert.equal(response.body.data.items.length, 1);
  assert.equal(response.body.data.items[0].id_producto, 1);
  assert.equal(response.body.data.items[0].tipo, 'entrada');
});
