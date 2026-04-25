const { ValidationError } = require('../models/inventory.model');

function createInventoryController({ service }) {
  return {
    async getAlerts(req, res, next) {
      try {
        const result = await service.getActiveAlerts({
          type: req.query.type,
          categoryId: req.query.categoryId
        });

        res.status(200).json(result);
      } catch (error) {
        if (error instanceof ValidationError || error.statusCode === 400) {
          res.status(400).json({ error: error.message });
          return;
        }

        next(error);
      }
    }
  };
}

module.exports = {
  createInventoryController
};
