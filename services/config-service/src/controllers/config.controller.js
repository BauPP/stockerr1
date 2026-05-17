class ConfigController {
  constructor(configService) {
    this.configService = configService;
  }

  /**
   * GET /api/config or GET /api/config/:key
   * Reads config value(s).
   */
  getConfig = async (req, res, next) => {
    try {
      const { key } = req.params;
      const result = await this.configService.getConfig(key);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /api/config/:key
   * Updates a single config parameter.
   */
  updateConfig = async (req, res, next) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      const result = await this.configService.updateConfig(key, value);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { ConfigController };
