const express = require('express');
const cors = require('cors');
require('dotenv').config();
 
const { buildServiceConfig } = require('./config/services');
const { createAuthMiddleware } = require('./middlewares/auth.middleware');
const { createAuthRoutes } = require('./routes/auth.routes');
const { createCategoryRoutes } = require('./routes/category.routes');
const { createAuditRoutes } = require('./routes/audit.routes');
const { createInventoryRoutes } = require('./routes/inventory.routes');
const { createProductRoutes } = require('./routes/product.routes');
const { createUserRoutes } = require('./routes/user.routes');
 
function createApp(options = {}) {
  const app = express();
  const config = buildServiceConfig(options);
  const fetchImpl = options.fetchImpl || fetch;
 
  const authMiddleware = createAuthMiddleware({
    authServiceUrl: config.authServiceUrl,
    fetchImpl,
  });
 
  app.use(cors());
  app.use(express.json());
 
  app.get('/', (_req, res) => {
    res.json({ success: true, message: 'API Gateway activo' });
  });
 
  app.use('/api/auth', createAuthRoutes({ authServiceUrl: config.authServiceUrl }));
 
  app.use(
    '/api/categories',
    createCategoryRoutes({
      categoryServiceUrl: config.categoryServiceUrl,
      authMiddleware,
      fetchImpl,
    })
  );
 
  app.use(
    '/api/users',
    createUserRoutes({
      userServiceUrl: config.userServiceUrl,
      authMiddleware,
      fetchImpl,
    })
  );

  app.use(
    '/api/products',
    createProductRoutes({
      productServiceUrl: config.productServiceUrl,
      authMiddleware,
      fetchImpl,
    })
  );

  app.use(
    '/api/inventory',
    createInventoryRoutes({
      inventoryServiceUrl: config.inventoryServiceUrl,
      authMiddleware,
      fetchImpl,
    })
  );

  app.use(
    '/api/audit',
    createAuditRoutes({
      auditServiceUrl: config.auditServiceUrl,
      authMiddleware,
      fetchImpl,
    })
  );
 
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
