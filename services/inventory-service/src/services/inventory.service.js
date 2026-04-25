const {
  ALERT_TYPES,
  EXPIRING_SOON_DAYS,
  ValidationError,
  calculateDaysToExpire,
  createDerivedAlert,
  describeInventoryAlertSourceShape,
  isFiniteNumber,
  normalizeAlertFilters,
  toIsoString
} = require('../models/inventory.model');

function buildLowStockAlert(source, now) {
  if (!isFiniteNumber(source.currentStock) || !isFiniteNumber(source.minStock)) {
    return null;
  }

  if (source.currentStock > source.minStock) {
    return null;
  }

  return createDerivedAlert(ALERT_TYPES.LOW_STOCK, source, now);
}

function buildHighStockAlert(source, now) {
  if (!isFiniteNumber(source.currentStock) || !isFiniteNumber(source.maxStock)) {
    return null;
  }

  if (source.currentStock < source.maxStock) {
    return null;
  }

  return createDerivedAlert(ALERT_TYPES.HIGH_STOCK, source, now);
}

function buildExpiringSoonAlert(source, now) {
  const daysToExpire = calculateDaysToExpire(source.expirationDate, now);

  if (daysToExpire === null || daysToExpire < 0 || daysToExpire > EXPIRING_SOON_DAYS) {
    return null;
  }

  return createDerivedAlert(ALERT_TYPES.EXPIRING_SOON, source, now);
}

function deriveAlerts(records = [], { now = new Date().toISOString() } = {}) {
  return records.flatMap((source) => {
    const derived = [
      buildLowStockAlert(source, now),
      buildHighStockAlert(source, now),
      buildExpiringSoonAlert(source, now)
    ];

    return derived.filter(Boolean);
  });
}

function applyAlertFilters(alerts, filters) {
  return alerts.filter((alert) => {
    if (filters.categoryId && alert.categoryId !== filters.categoryId) {
      return false;
    }

    if (filters.type.length > 0 && !filters.type.includes(alert.type)) {
      return false;
    }

    return true;
  });
}

function createInventoryService({ repository, nowProvider = () => new Date().toISOString() }) {
  if (!repository || typeof repository.getAlertSourceRows !== 'function') {
    throw new ValidationError('Inventory repository must expose getAlertSourceRows(filters)');
  }

  return {
    async getActiveAlerts(rawFilters = {}) {
      const filters = normalizeAlertFilters(rawFilters);
      const generatedAt = nowProvider();
      const sourceRows = await repository.getAlertSourceRows(filters);
      const alerts = applyAlertFilters(deriveAlerts(sourceRows, { now: generatedAt }), filters);

      return {
        data: alerts,
        meta: {
          generatedAt: toIsoString(generatedAt),
          filters
        }
      };
    }
  };
}

module.exports = {
  ALERT_TYPES,
  EXPIRING_SOON_DAYS,
  applyAlertFilters,
  createInventoryService,
  deriveAlerts,
  describeInventoryAlertSourceShape,
  normalizeAlertFilters
};
