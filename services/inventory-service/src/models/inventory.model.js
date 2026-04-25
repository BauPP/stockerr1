const ALERT_TYPES = Object.freeze({
  LOW_STOCK: 'low-stock',
  HIGH_STOCK: 'high-stock',
  EXPIRING_SOON: 'expiring-soon'
});

const VALID_ALERT_TYPES = new Set(Object.values(ALERT_TYPES));
const EXPIRING_SOON_DAYS = 7;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function toDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoString(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function normalizeAlertFilters(filters = {}) {
  const normalizedTypes = Array.isArray(filters.type)
    ? filters.type.flatMap((value) => String(value).split(','))
    : String(filters.type || '')
        .split(',')
        .filter(Boolean);

  const uniqueTypes = [...new Set(normalizedTypes.map((value) => value.trim()).filter(Boolean))];
  const invalidType = uniqueTypes.find((value) => !VALID_ALERT_TYPES.has(value));

  if (invalidType) {
    throw new ValidationError('Invalid alert type filter');
  }

  return {
    type: uniqueTypes,
    categoryId: filters.categoryId ? String(filters.categoryId) : null
  };
}

function calculateDaysToExpire(expirationDate, now) {
  const expiration = toDate(expirationDate);
  const reference = toDate(now);

  if (!expiration || !reference) {
    return null;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((expiration.getTime() - reference.getTime()) / millisecondsPerDay);
}

function createAlertId(type, source) {
  return `${type}:${source.productId}:${source.expirationDate || 'stock'}`;
}

function createDerivedAlert(type, source, now) {
  const daysToExpire = calculateDaysToExpire(source.expirationDate, now);

  return {
    id: createAlertId(type, source),
    type,
    productId: source.productId,
    productName: source.productName,
    categoryId: source.categoryId,
    currentStock: isFiniteNumber(source.currentStock) ? source.currentStock : null,
    minStock: isFiniteNumber(source.minStock) ? source.minStock : null,
    maxStock: isFiniteNumber(source.maxStock) ? source.maxStock : null,
    expirationDate: toIsoString(source.expirationDate),
    daysToExpire: type === ALERT_TYPES.EXPIRING_SOON ? daysToExpire : null
  };
}

function describeInventoryAlertSourceShape() {
  return 'Minimum alert source shape: productId, productName, categoryId, currentStock, minStock, maxStock, expirationDate';
}

module.exports = {
  ALERT_TYPES,
  EXPIRING_SOON_DAYS,
  VALID_ALERT_TYPES,
  ValidationError,
  calculateDaysToExpire,
  createDerivedAlert,
  describeInventoryAlertSourceShape,
  isFiniteNumber,
  normalizeAlertFilters,
  toDate,
  toIsoString
};
