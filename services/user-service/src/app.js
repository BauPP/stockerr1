const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool } = require('./config/db');
const { UserController } = require('./controllers/user.controller');
const { PgUserRepository, InMemoryUserRepository } = require('./repositories/user.repository');
const { createUserRoutes } = require('./routes/user.routes');
const { UserService } = require('./services/user.service');

function createApp(options = {}) {
  const app = express();

  const repository =
    options.repository ||
    (process.env.USER_REPOSITORY === 'inmemory'
      ? new InMemoryUserRepository({ users: options.seedUsers || [] })
      : new PgUserRepository(pool));

  const service =
    options.service ||
    new UserService({
      repository,
      bcryptSaltRounds: options.serviceOptions?.bcryptSaltRounds || 10,
    });

  const controller = options.controller || new UserController(service);

  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({ success: true, message: 'User Service activo' });
  });

  app.use('/api/users', createUserRoutes(controller));

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
