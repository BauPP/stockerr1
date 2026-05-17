'use strict';

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { createVerifyJWT } = require('../../../shared/middlewares/verifyJWT');

function createApp(options = {}) {
  const app = express();

  const verifyJWT =
    options.verifyJWT ||
    createVerifyJWT({
      authServiceUrl:
        options.authServiceUrl || process.env.AUTH_SERVICE_URL || 'http://auth-service:3002',
    });

  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({ success: true, message: 'Config Service activo' });
  });

  // Placeholder for future config routes
  // app.use('/api/config', verifyJWT, createConfigRoutes(controller));

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
