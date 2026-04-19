const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const request = require('supertest');

const { createApp: createAuthApp } = require('../../services/auth-service/src/app');
const {
  createApp: createCategoryApp,
  InMemoryCategoryRepository,
} = require('../../services/category-service/src/app');
const { createApp: createInventoryApp } = require('../../services/inventory-service/src/app');
const {
  InMemoryInventoryRepository,
} = require('../../services/inventory-service/src/repositories/inventory.repository');
const { createApp: createProductApp } = require('../../services/product-service/src/app');
const {
  InMemoryProductRepository,
} = require('../../services/product-service/src/repositories/product.repository');
const { createApp: createUserApp } = require('../../services/user-service/src/app');
const {
  InMemoryUserRepository,
} = require('../../services/user-service/src/repositories/user.repository');
const { createApp: createGatewayApp } = require('../src/app');

async function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        return reject(error);
      }

      return resolve();
    });
  });
}

function createSeedUsers() {
  return [
    {
      id_usuario: 1,
      nombre_usuario: 'admin',
      nombre: 'Administrador Demo',
      rol: 'Administrador',
      estado: 'activo',
      contrasena_hash: bcrypt.hashSync('Admin1234', 10),
      intentos_fallidos: 0,
      bloqueo_hasta: null,
    },
    {
      id_usuario: 2,
      nombre_usuario: 'operador',
      nombre: 'Operador Demo',
      rol: 'Operador',
      estado: 'activo',
      contrasena_hash: bcrypt.hashSync('Operador123', 10),
      intentos_fallidos: 0,
      bloqueo_hasta: null,
    },
  ];
}

test('Gateway integra login, users, categories, products e inventory movements', async () => {
  const authApp = createAuthApp({
    seedUsers: createSeedUsers(),
    serviceOptions: {
      jwtSecret: 'test-secret',
    },
  });

  const userApp = createUserApp({
    repository: new InMemoryUserRepository({
      users: [
        {
          id_usuario: 1,
          id_rol: 1,
          nombre: 'Administrador Demo',
          correo: 'admin@stockerr.test',
          contrasena: bcrypt.hashSync('Admin1234', 10),
          estado: true,
          fecha_creacion: new Date().toISOString(),
          ultimo_acceso: null,
          intentos_fallidos: 0,
          bloqueado: false,
        },
      ],
    }),
    serviceOptions: {
      bcryptSaltRounds: 4,
    },
  });

  const categoryApp = createCategoryApp({
    repository: new InMemoryCategoryRepository({
      categories: [
        {
          id_categoria: 1,
          nombre_categoria: 'Bebidas',
          descripcion: 'Productos frios',
          estado: true,
        },
      ],
      products: [],
    }),
  });

  const productApp = createProductApp({
    repository: new InMemoryProductRepository({
      categories: [
        {
          id_categoria: 1,
          nombre_categoria: 'Bebidas',
          estado: true,
        },
      ],
      products: [],
    }),
  });

  const authServer = await startServer(authApp);
  const userServer = await startServer(userApp);
  const categoryServer = await startServer(categoryApp);
  const productServer = await startServer(productApp);

  const authPort = authServer.address().port;
  const userPort = userServer.address().port;
  const categoryPort = categoryServer.address().port;
  const productPort = productServer.address().port;

  const inventoryApp = createInventoryApp({
    repository: new InMemoryInventoryRepository({
      products: [
        {
          id_producto: 1,
          nombre: 'Agua Mineral 500ml',
          stock_actual: 10,
          estado: true,
        },
      ],
      movements: [],
    }),
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    notifier: { notifyMovementRegistered: async () => {} },
  });
  const inventoryServer = await startServer(inventoryApp);

  const inventoryPort = inventoryServer.address().port;

  const gatewayApp = createGatewayApp({
    authServiceUrl: `http://127.0.0.1:${authPort}`,
    userServiceUrl: `http://127.0.0.1:${userPort}`,
    categoryServiceUrl: `http://127.0.0.1:${categoryPort}`,
    productServiceUrl: `http://127.0.0.1:${productPort}`,
    inventoryServiceUrl: `http://127.0.0.1:${inventoryPort}`,
  });

  const adminLogin = await request(gatewayApp).post('/api/auth/login').send({
    nombre_usuario: 'admin',
    contrasena: 'Admin1234',
  });

  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.body.data.token;

  const operatorLogin = await request(gatewayApp).post('/api/auth/login').send({
    nombre_usuario: 'operador',
    contrasena: 'Operador123',
  });

  assert.equal(operatorLogin.status, 200);
  const operatorToken = operatorLogin.body.data.token;

  const createUserResponse = await request(gatewayApp)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      nombre: 'Nuevo Usuario',
      correo: 'nuevo@stockerr.test',
      contrasena: 'ClaveSegura123',
      id_rol: 2,
    });

  assert.equal(createUserResponse.status, 201);
  assert.equal(createUserResponse.body.success, true);

  const createCategoryResponse = await request(gatewayApp)
    .post('/api/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      nombre_categoria: 'Lacteos',
      descripcion: 'Cadena de frio',
    });

  assert.equal(createCategoryResponse.status, 201);
  assert.equal(createCategoryResponse.body.success, true);

  const createProductResponse = await request(gatewayApp)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      nombre: 'Agua Mineral 500ml',
      codigo_barras: '7501234567890',
      id_categoria: 1,
      precio_compra: 10,
      precio_venta: 15,
      stock_inicial: 10,
      stock_minimo: 2,
      ubicacion: 'Pasillo 1',
    });

  assert.equal(createProductResponse.status, 201);
  assert.equal(createProductResponse.body.success, true);
  assert.equal(createProductResponse.body.data.id_producto, 1);

  const listProductsResponse = await request(gatewayApp)
    .get('/api/products?page=1&size=10')
    .set('Authorization', `Bearer ${operatorToken}`);

  assert.equal(listProductsResponse.status, 200);
  assert.equal(listProductsResponse.body.data.productos.length, 1);

  const registerMovementResponse = await request(gatewayApp)
    .post('/api/inventory/movements')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({
      id_producto: 1,
      tipo_movimiento: 'entrada',
      cantidad: 5,
      numero_factura: 'FAC-001',
      comentario: 'Ingreso por compra',
    });

  assert.equal(registerMovementResponse.status, 201);
  assert.equal(registerMovementResponse.body.success, true);
  assert.equal(registerMovementResponse.body.data.nuevo_stock, 15);

  const listMovementsResponse = await request(gatewayApp)
    .get('/api/inventory/movements?producto=1&tipo=entrada')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(listMovementsResponse.status, 200);
  assert.equal(listMovementsResponse.body.success, true);
  assert.equal(listMovementsResponse.body.data.total, 1);

  const forbiddenProductCreate = await request(gatewayApp)
    .post('/api/products')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({
      nombre: 'Producto no permitido',
      codigo_barras: '7501234567899',
      id_categoria: 1,
      precio_compra: 10,
      precio_venta: 12,
      stock_inicial: 1,
    });

  assert.equal(forbiddenProductCreate.status, 403);
  assert.equal(forbiddenProductCreate.body.error.code, 'AUTH_FORBIDDEN');

  await stopServer(inventoryServer);
  await stopServer(productServer);
  await stopServer(categoryServer);
  await stopServer(userServer);
  await stopServer(authServer);
});
