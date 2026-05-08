'use strict';

class ConfigController {
  constructor(configService) {
    this.configService = configService;
  }

  getAllConfig = async (req, res, next) => {
    try {
      const result = await this.configService.getAll();
      res.status(200).json({ success: true, data: result.data });
    } catch (error) {
      next(error);
    }
  };

  updateBulkConfig = async (req, res, next) => {
    try {
      const result = await this.configService.updateBulkConfig(req.body);
      const hasErrors = result.data.errors.length > 0;
      const allFailed = result.data.errors.length === Object.keys(req.body || {}).length;
      const status = allFailed ? 400 : hasErrors ? 207 : 200;
      res.status(status).json({ success: !allFailed, data: result.data });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { ConfigController };
