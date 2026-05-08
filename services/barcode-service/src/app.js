const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool } = require('./config/db');
const { BarcodeController } = require('./controllers/barcode.controller');
const { PgBarcodeRepository, InMemoryBarcodeRepository } = require('./repositories/barcode.repository');
const { createBarcodeRoutes } = require('./routes/barcode.routes');
const { BarcodeService } = require('./services/barcode.service');

function createApp(options = {}) {
  const app = express();

  const repository =
    options.repository ||
    (process.env.BARCODE_REPOSITORY === 'inmemory'
      ? new InMemoryBarcodeRepository({
          products: options.seedProducts || [],
        })
      : new PgBarcodeRepository(pool));

  const service = options.service || new BarcodeService({ repository });
  const controller = options.controller || new BarcodeController(service);

  app.use(cors());
  app.use(express.json());

  // Expose repository for test access
  app.set('repository', repository);

  app.get('/', (_req, res) => {
    res.json({ success: true, message: 'Barcode Service activo' });
  });

  app.use('/api/barcodes', createBarcodeRoutes(controller));

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
