const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool } = require('./config/db');
const { ProductController } = require('./controllers/product.controller');
const { PgProductRepository, InMemoryProductRepository } = require('./repositories/product.repository');
const { createProductRoutes } = require('./routes/product.routes');
const { ProductService } = require('./services/product.service');
const { createVerifyJWT } = require('../../../shared/middlewares/verifyJWT');

function createApp(options = {}) {
  const app = express();

  const repository =
    options.repository ||
    (process.env.PRODUCT_REPOSITORY === 'inmemory'
      ? new InMemoryProductRepository({
          products: options.seedProducts || [],
          categories: options.seedCategories || [],
        })
      : new PgProductRepository(pool));

  const service = options.service || new ProductService({ repository });
  const controller = options.controller || new ProductController(service);

  const verifyJWT =
    options.verifyJWT ||
    createVerifyJWT({
      authServiceUrl:
        options.authServiceUrl || process.env.AUTH_SERVICE_URL || 'http://auth-service:3002',
    });

  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({ success: true, message: 'Product Service activo' });
  });

  app.use('/api/products', verifyJWT, createProductRoutes(controller));

  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Error interno del servidor',
      },
    });
  });

  return app;
}

module.exports = { createApp };
