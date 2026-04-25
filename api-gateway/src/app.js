const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { createServicesConfig } = require('./config/services');
const { createInventoryRouter } = require('./routes/inventory.routes');

function createApp({ fetchImpl, servicesConfig } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.get('/', (_req, res) => {
    res.send('API Gateway funcionando 🚀');
  });
  app.use('/api/inventory', createInventoryRouter({
    fetchImpl,
    servicesConfig: servicesConfig || createServicesConfig()
  }));

  return app;
}

module.exports = {
  createApp
};
