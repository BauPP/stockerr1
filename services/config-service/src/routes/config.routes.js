'use strict';

const { Router } = require('express');

function createConfigRoutes(controller) {
  const router = Router();

  router.get('/', controller.getAllConfig);
  router.put('/', controller.updateBulkConfig);

  return router;
}

module.exports = { createConfigRoutes };
