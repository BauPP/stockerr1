const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { InMemoryAuthRepository } = require('./repositories/auth.repository');
const { AuthService } = require('./services/auth.service');
const { AuthController } = require('./controllers/auth.controller');
const { createAuthRoutes } = require('./routes/auth.routes');

function createDefaultUser() {
  return {
    id_usuario: 1,
    nombre_usuario: process.env.DEMO_USER_USERNAME || 'admin',
    nombre: process.env.DEMO_USER_NAME || 'Administrador Demo',
    rol: process.env.DEMO_USER_ROLE || 'Administrador',
    estado: 'activo',
    contrasena_hash: bcrypt.hashSync(process.env.DEMO_USER_PASSWORD || 'Admin1234', 10),
    intentos_fallidos: 0,
    bloqueo_hasta: null,
  };
}

function createApp(options = {}) {
  const app = express();

  const repository =
    options.repository ||
    new InMemoryAuthRepository({ users: options.seedUsers || [createDefaultUser()] });

  const service =
    options.service ||
    new AuthService({
      repository,
      jwtSecret:
        options.serviceOptions?.jwtSecret || process.env.JWT_SECRET || 'change-me-in-production',
      jwtExpiresIn: options.serviceOptions?.jwtExpiresIn || process.env.JWT_EXPIRES_IN || '30m',
      maxLoginAttempts:
        options.serviceOptions?.maxLoginAttempts || Number(process.env.MAX_LOGIN_ATTEMPTS || 3),
      lockMinutes:
        options.serviceOptions?.lockMinutes || Number(process.env.LOCK_TIME_MINUTES || 15),
    });

  const controller = options.controller || new AuthController(service);

  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({ success: true, message: 'Auth Service activo' });
  });

  app.use('/api/auth', createAuthRoutes(controller));

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
