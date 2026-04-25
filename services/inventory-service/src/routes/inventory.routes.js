const express = require('express');

function createInventoryRouter({ controller }) {
  const router = express.Router();

  router.get('/alerts', controller.getAlerts);

  return router;
}

module.exports = {
  createInventoryRouter
};
