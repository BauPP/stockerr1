require('dotenv').config();

function buildServiceConfig(overrides = {}) {
  return {
    authServiceUrl: overrides.authServiceUrl || process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
    categoryServiceUrl:overrides.categoryServiceUrl || process.env.CATEGORY_SERVICE_URL || 'http://localhost:3003',
    userServiceUrl:overrides.userServiceUrl || process.env.USER_SERVICE_URL || 'http://localhost:3004',
  };
}

module.exports = { buildServiceConfig };
