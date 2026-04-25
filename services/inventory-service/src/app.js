const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { createInventoryReadRecords } = require('./config/db');
const { createInventoryController } = require('./controllers/inventory.controller');
const { createInventoryRepository } = require('./repositories/inventory.repository');
const { createInventoryRouter } = require('./routes/inventory.routes');
const { createInventoryService } = require('./services/inventory.service');

function createApp({ repository, now, service } = {}) {
  const app = express();
  const inventoryRepository = repository || createInventoryRepository({ readRecords: createInventoryReadRecords() });
  const inventoryService = service || createInventoryService({
    repository: inventoryRepository,
    nowProvider: () => now || new Date().toISOString()
  });
  const controller = createInventoryController({ service: inventoryService });

  app.use(cors());
  app.use(express.json());
  app.get('/', (_req, res) => {
    res.send('Inventory Service funcionando 🚀');
  });
  app.use('/inventory', createInventoryRouter({ controller }));
  app.use((error, _req, res, _next) => {
    res.status(error.statusCode || 500).json({ error: error.message || 'Internal server error' });
  });

  return app;
}

module.exports = {
  createApp
};
