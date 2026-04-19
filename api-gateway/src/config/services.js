require('dotenv').config();

function buildServiceConfig(overrides = {}) {
  return {
    authServiceUrl: overrides.authServiceUrl || process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
    categoryServiceUrl:overrides.categoryServiceUrl || process.env.CATEGORY_SERVICE_URL || 'http://localhost:3003',
    userServiceUrl:overrides.userServiceUrl || process.env.USER_SERVICE_URL || 'http://localhost:3004',
    productServiceUrl: overrides.productServiceUrl || process.env.PRODUCT_SERVICE_URL || 'http://localhost:3001',
    inventoryServiceUrl:
      overrides.inventoryServiceUrl || process.env.INVENTORY_SERVICE_URL || 'http://localhost:3005',
  };
}

module.exports = { buildServiceConfig };
