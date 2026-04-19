const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool } = require('./config/db');
const { buildServiceConfig } = require('./config/services');
const { InventoryController } = require('./controllers/inventory.controller');
const { createAuthMiddleware } = require('./middlewares/auth.middleware');
const {
  PgInventoryRepository,
  InMemoryInventoryRepository,
} = require('./repositories/inventory.repository');
const { createInventoryRoutes } = require('./routes/inventory.routes');
const { InventoryNotifier } = require('./services/inventory-notifier.service');
const { InventoryService } = require('./services/inventory.service');

function createApp(options = {}) {
  const app = express();
  const config = buildServiceConfig(options);
  const fetchImpl = options.fetchImpl || fetch;

  const repository =
    options.repository ||
    (process.env.INVENTORY_REPOSITORY === 'inmemory'
      ? new InMemoryInventoryRepository({
          products: options.seedProducts || [],
          movements: options.seedMovements || [],
        })
      : new PgInventoryRepository({
          pool,
        }));

  const notifier =
    options.notifier ||
    new InventoryNotifier({
      ms06MovementWebhookUrl: config.ms06MovementWebhookUrl,
      ms09MovementWebhookUrl: config.ms09MovementWebhookUrl,
      fetchImpl,
    });

  const service = options.service || new InventoryService({ repository, notifier });
  const controller = options.controller || new InventoryController(service);
  const authMiddleware =
    options.authMiddleware ||
    createAuthMiddleware({
      authServiceUrl: config.authServiceUrl,
      fetchImpl,
    });

  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({ success: true, message: 'Inventory Service activo' });
  });

  app.use('/api/inventory', authMiddleware, createInventoryRoutes(controller));

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
