function sendSuccess(res, status, payload) {
  const body = {
    success: true,
    data: payload.data ?? payload,
  };

  res.status(status).json(body);
}

class BarcodeController {
  constructor(barcodeService) {
    this.barcodeService = barcodeService;
  }

  lookupByCode = async (req, res, next) => {
    try {
      const { code } = req.params;
      const product = await this.barcodeService.lookupByCode(code);
      sendSuccess(res, 200, product);
    } catch (error) {
      next(error);
    }
  };

  validate = async (req, res, next) => {
    try {
      const { code } = req.body;
      const result = this.barcodeService.validateCode(code);
      sendSuccess(res, 200, result);
    } catch (error) {
      next(error);
    }
  };

  generate = async (req, res, next) => {
    try {
      const { prefix } = req.body;
      const result = await this.barcodeService.generateCode({ prefix });
      sendSuccess(res, 200, result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { BarcodeController };
