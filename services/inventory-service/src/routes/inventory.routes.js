const { Router } = require('express');

function createInventoryRoutes(controller) {
  const router = Router();

  router.post('/movements', controller.registerMovement);
  router.get('/movements', controller.listMovements);

  return router;
}

module.exports = { createInventoryRoutes };
