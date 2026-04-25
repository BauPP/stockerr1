function createServicesConfig(overrides = {}) {
  return {
    inventoryServiceUrl: overrides.inventoryServiceUrl || process.env.INVENTORY_SERVICE_URL || 'http://inventory-service:3004'
  };
}

module.exports = {
  createServicesConfig
};
