'use strict';

function createServicesConfig(overrides = {}) {
  return {
    authServiceUrl:
      overrides.authServiceUrl ||
      process.env.AUTH_SERVICE_URL ||
      'http://localhost:3002',
    productServiceUrl:
      overrides.productServiceUrl ||
      process.env.PRODUCT_SERVICE_URL ||
      'http://localhost:3001',
    categoryServiceUrl:
      overrides.categoryServiceUrl ||
      process.env.CATEGORY_SERVICE_URL ||
      'http://localhost:3003',
    userServiceUrl:
      overrides.userServiceUrl ||
      process.env.USER_SERVICE_URL ||
      'http://localhost:3004',
    inventoryServiceUrl:
      overrides.inventoryServiceUrl ||
      process.env.INVENTORY_SERVICE_URL ||
      'http://localhost:3005',
    auditServiceUrl:
      overrides.auditServiceUrl ||
      process.env.AUDIT_SERVICE_URL ||
      'http://localhost:3006',
    exportServiceUrl:
      overrides.exportServiceUrl ||
      process.env.EXPORT_SERVICE_URL ||
      'http://localhost:3007',
    providerServiceUrl:
      overrides.providerServiceUrl ||
      process.env.PROVIDER_SERVICE_URL ||
      'http://localhost:3008',
    supplierServiceUrl:
      overrides.supplierServiceUrl ||
      process.env.SUPPLIER_SERVICE_URL ||
      'http://localhost:3008',
    configServiceUrl:
      overrides.configServiceUrl ||
      process.env.CONFIG_SERVICE_URL ||
      'http://localhost:3009',
    barcodeServiceUrl:
      overrides.barcodeServiceUrl ||
      process.env.BARCODE_SERVICE_URL ||
      'http://localhost:3010',
  };
}

module.exports = {
  createServicesConfig,
};