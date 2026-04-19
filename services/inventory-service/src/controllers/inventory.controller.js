const {
  parseMovementFilters,
  validateCreateMovementPayload,
} = require('../models/inventory.model');

function sendSuccess(res, status, payload) {
  res.status(status).json({
    success: true,
    data: payload.data ?? payload,
  });
}

class InventoryController {
  constructor(inventoryService) {
    this.inventoryService = inventoryService;
  }

  registerMovement = async (req, res, next) => {
    try {
      const payload = validateCreateMovementPayload(req.body);
      const result = await this.inventoryService.registerMovement(payload, {
        actor: req.authUser,
      });

      sendSuccess(res, 201, result);
    } catch (error) {
      next(error);
    }
  };

  listMovements = async (req, res, next) => {
    try {
      const filters = parseMovementFilters(req.query);
      const result = await this.inventoryService.listMovements(filters);
      sendSuccess(res, 200, result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { InventoryController };
