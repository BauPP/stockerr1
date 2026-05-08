const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool } = require('./config/db');
const { ConfigController } = require('./controllers/config.controller');
const {
  PgConfigRepository,
  InMemoryConfigRepository,
} = require('./repositories/config.repository');
const { createConfigRoutes } = require('./routes/config.routes');
const { ConfigService } = require('./services/config.service');

function createApp(options = {}) {
  const app = express();

  const repository =
    options.repository ||
    (process.env.CONFIG_REPOSITORY === 'inmemory'
      ? new InMemoryConfigRepository(options.seedConfig || {})
      : new PgConfigRepository(pool));

  const service = options.service || new ConfigService({ repository });
  const controller = options.controller || new ConfigController(service);

  app.use(cors());
  app.use(express.json());

  // Expose repository for test access
  app.set('repository', repository);

  app.get('/', (_req, res) => {
    res.json({ success: true, message: 'Config Service activo' });
  });

  app.use(
    '/api/config',
    createConfigRoutes(controller, {
      authMiddleware: options.authMiddleware,
      adminOnly: options.adminOnly,
    })
  );

  // Unified error handler (Express 5: 4-arg middleware)
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
