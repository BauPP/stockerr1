const { Router } = require('express');

function createBarcodeRoutes(controller) {
  const router = Router();

  router.get('/:code', controller.lookupByCode);
  router.post('/validate', controller.validate);
  router.post('/generate', controller.generate);

  return router;
}

module.exports = { createBarcodeRoutes };
