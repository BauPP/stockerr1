const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { buildServiceConfig } = require('./config/services');
const { createAuthMiddleware } = require('./middlewares/auth.middleware');
const { createAuthRoutes } = require('./routes/auth.routes');

function createApp(options = {}) {
  const app = express();
  const config = buildServiceConfig(options);
  const authMiddleware = createAuthMiddleware({
    authServiceUrl: config.authServiceUrl,
    fetchImpl: options.fetchImpl || fetch,
  });

  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({ success: true, message: 'API Gateway activo' });
  });

  app.use('/api/auth', createAuthRoutes({ authServiceUrl: config.authServiceUrl }));

  app.get('/api/protected/ping', authMiddleware, (req, res) => {
    res.json({
      success: true,
      data: {
        message: 'Acceso autorizado',
        usuario: req.authUser,
      },
    });
  });

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
