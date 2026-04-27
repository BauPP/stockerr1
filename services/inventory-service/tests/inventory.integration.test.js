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

// ===========================================================================
// Validación de stock_minimo en salidas (fix reportado post-PR)
// ===========================================================================

function buildTestContextWithMinStock(
  user = { id_usuario: 10, nombre: 'Operador Demo', rol: 'Operador' }
) {
  const repository = new InMemoryInventoryRepository({
    products: [
      {
        id_producto: 1,
        nombre: 'Cafe Premium 250g',
        stock_actual: 12,
        stock_minimo: 5,
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

test('POST /api/inventory/movements rechaza salida que deja stock por debajo del minimo', async () => {
  const { app, repository } = buildTestContextWithMinStock();

  // stock_actual=12, stock_minimo=5. Salida de 8 dejaría stock en 4 (< 5).
  const response = await request(app).post('/api/inventory/movements').send({
    id_producto: 1,
    tipo_movimiento: 'salida',
    cantidad: 8,
    motivo: 'venta',
  });

  assert.equal(response.status, 422);
  assert.equal(response.body.success, false);
  assert.equal(response.body.error.code, 'BELOW_MINIMUM_STOCK');
  assert.match(response.body.error.message, /m[ií]nimo permitido/);
  assert.equal(repository.movements.length, 0);

  // El stock NO se modificó.
  const product = await repository.getProductById(1);
  assert.equal(product.stock_actual, 12);
});

test('POST /api/inventory/movements permite salida que deja stock justo en el minimo', async () => {
  const { app, repository } = buildTestContextWithMinStock();

  // stock_actual=12, stock_minimo=5. Salida de 7 deja stock en 5 (= minimo).
  const response = await request(app).post('/api/inventory/movements').send({
    id_producto: 1,
    tipo_movimiento: 'salida',
    cantidad: 7,
    motivo: 'venta',
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.nuevo_stock, 5);
  assert.equal(repository.movements.length, 1);
});

test('POST /api/inventory/movements?force=true permite a Administrador cruzar el minimo', async () => {
  const { app, repository } = buildTestContextWithMinStock({
    id_usuario: 1,
    nombre: 'Admin Demo',
    rol: 'Administrador',
  });

  const response = await request(app)
    .post('/api/inventory/movements?force=true')
    .send({
      id_producto: 1,
      tipo_movimiento: 'salida',
      cantidad: 10,
      motivo: 'venta',
      comentario: 'Pedido urgente autorizado por gerencia',
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.nuevo_stock, 2); // bajo el minimo (5), pero forzado
  assert.equal(repository.movements.length, 1);
});

test('POST /api/inventory/movements?force=true rechaza override de Operador', async () => {
  // Operador NO puede usar force=true para saltarse el mínimo.
  const { app } = buildTestContextWithMinStock({
    id_usuario: 10,
    nombre: 'Operador',
    rol: 'Operador',
  });

  const response = await request(app)
    .post('/api/inventory/movements?force=true')
    .send({
      id_producto: 1,
      tipo_movimiento: 'salida',
      cantidad: 10,
      motivo: 'venta',
    });

  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, 'BELOW_MINIMUM_STOCK');
});

test('POST /api/inventory/movements no aplica validacion de minimo en ajustes', async () => {
  // Los ajustes son correcciones de inventario real: un faltante legítimo
  // puede dejar el stock bajo mínimo y eso es válido.
  const { app, repository } = buildTestContextWithMinStock({
    id_usuario: 1,
    nombre: 'Admin',
    rol: 'Administrador',
  });

  const response = await request(app).post('/api/inventory/movements').send({
    id_producto: 1,
    tipo_movimiento: 'ajuste',
    cantidad: 9,
    tipo_ajuste: 'faltante',
    motivo_ajuste: 'Conteo ciclico revelo faltante',
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.nuevo_stock, 3); // bajo mínimo (5), pero permitido
  assert.equal(repository.movements.length, 1);
});

// ===========================================================================
// PgInventoryRepository.getAlertSourceRows (fix: query SQL real)
// ===========================================================================

const {
  PgInventoryRepository,
} = require('../src/repositories/inventory.repository');

function createMockPool(rowsByCall) {
  const calls = [];
  const queue = Array.isArray(rowsByCall) ? [...rowsByCall] : [rowsByCall];
  return {
    calls,
    pool: {
      async query(sql, params) {
        calls.push({ sql, params });
        const next = queue.shift() ?? { rows: [] };
        return next;
      },
    },
  };
}

test('PgInventoryRepository.getAlertSourceRows mapea columnas SQL al shape esperado', async () => {
  const { pool, calls } = createMockPool({
    rows: [
      {
        id_producto: 7,
        nombre: 'Leche Entera 1L',
        id_categoria: 3,
        stock_actual: '4',
        stock_minimo: '5',
        stock_maximo: '20',
        fecha_vencimiento: '2026-05-02',
      },
    ],
  });
  const repo = new PgInventoryRepository({ pool });

  const result = await repo.getAlertSourceRows();

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /FROM productos/);
  assert.match(calls[0].sql, /p\.estado = true/);
  assert.deepEqual(result, [
    {
      productId: 7,
      productName: 'Leche Entera 1L',
      categoryId: 3,
      currentStock: 4,
      minStock: 5,
      maxStock: 20,
      expirationDate: '2026-05-02',
    },
  ]);
});

test('PgInventoryRepository.getAlertSourceRows filtra por categoryId cuando se provee', async () => {
  const { pool, calls } = createMockPool({ rows: [] });
  const repo = new PgInventoryRepository({ pool });

  await repo.getAlertSourceRows({ categoryId: '3' });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /p\.id_categoria = \$1/);
  assert.deepEqual(calls[0].params, ['3']);
});

test('PgInventoryRepository.getAlertSourceRows tolera columnas en null', async () => {
  // Producto sin fecha_vencimiento ni stock_maximo: las alertas correspondientes
  // simplemente no se generan, pero la fila se mapea sin lanzar.
  const { pool } = createMockPool({
    rows: [
      {
        id_producto: 9,
        nombre: 'Tornillos M5',
        id_categoria: 8,
        stock_actual: '100',
        stock_minimo: '10',
        stock_maximo: null,
        fecha_vencimiento: null,
      },
    ],
  });
  const repo = new PgInventoryRepository({ pool });

  const result = await repo.getAlertSourceRows();

  assert.equal(result[0].maxStock, undefined);
  assert.equal(result[0].expirationDate, null);
});
