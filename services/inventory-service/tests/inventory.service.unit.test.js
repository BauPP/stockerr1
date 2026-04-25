const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ALERT_TYPES,
  EXPIRING_SOON_DAYS,
  deriveAlerts,
  normalizeAlertFilters,
  describeInventoryAlertSourceShape
} = require('../src/services/inventory.service');

test('deriveAlerts creates low-stock and high-stock alerts when thresholds are met', () => {
  const alerts = deriveAlerts([
    {
      productId: 'product-low',
      productName: 'Low Product',
      categoryId: 'cat-1',
      currentStock: 2,
      minStock: 5,
      maxStock: 20
    },
    {
      productId: 'product-high',
      productName: 'High Product',
      categoryId: 'cat-2',
      currentStock: 25,
      minStock: 5,
      maxStock: 20
    }
  ], { now: '2026-04-25T00:00:00.000Z' });

  assert.equal(alerts.length, 2);
  assert.deepEqual(
    alerts.map((alert) => ({ type: alert.type, productId: alert.productId })),
    [
      { type: ALERT_TYPES.LOW_STOCK, productId: 'product-low' },
      { type: ALERT_TYPES.HIGH_STOCK, productId: 'product-high' }
    ]
  );
});

test('deriveAlerts creates expiring-soon alerts only inside the fixed window', () => {
  const alerts = deriveAlerts([
    {
      productId: 'product-expiring',
      productName: 'Expiring Product',
      categoryId: 'cat-1',
      currentStock: 12,
      expirationDate: '2026-05-02T00:00:00.000Z'
    },
    {
      productId: 'product-safe',
      productName: 'Safe Product',
      categoryId: 'cat-1',
      currentStock: 12,
      expirationDate: '2026-05-10T00:00:00.000Z'
    }
  ], { now: '2026-04-25T00:00:00.000Z' });

  assert.equal(EXPIRING_SOON_DAYS, 7);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, ALERT_TYPES.EXPIRING_SOON);
  assert.equal(alerts[0].productId, 'product-expiring');
  assert.equal(alerts[0].daysToExpire, 7);
});

test('deriveAlerts skips alert types when required source fields are missing', () => {
  const alerts = deriveAlerts([
    {
      productId: 'missing-thresholds',
      productName: 'Missing Thresholds',
      categoryId: 'cat-1',
      currentStock: 1
    },
    {
      productId: 'missing-expiration',
      productName: 'Missing Expiration',
      categoryId: 'cat-1',
      currentStock: 10,
      minStock: 5,
      maxStock: 15
    }
  ], { now: '2026-04-25T00:00:00.000Z' });

  assert.equal(alerts.length, 0);
});

test('deriveAlerts emits multiple alerts for the same product and removes them after normalization', () => {
  const source = {
    productId: 'product-combo',
    productName: 'Combo Product',
    categoryId: 'cat-1',
    currentStock: 2,
    minStock: 5,
    maxStock: 50,
    expirationDate: '2026-04-28T00:00:00.000Z'
  };

  const activeAlerts = deriveAlerts([source], { now: '2026-04-25T00:00:00.000Z' });
  const normalizedAlerts = deriveAlerts([
    {
      ...source,
      currentStock: 10,
      expirationDate: '2026-05-20T00:00:00.000Z'
    }
  ], { now: '2026-04-25T00:00:00.000Z' });

  assert.deepEqual(
    activeAlerts.map((alert) => alert.type).sort(),
    [ALERT_TYPES.EXPIRING_SOON, ALERT_TYPES.LOW_STOCK].sort()
  );
  assert.deepEqual(normalizedAlerts, []);
});

test('normalizeAlertFilters accepts optional type lists and categoryId', () => {
  assert.deepEqual(normalizeAlertFilters({}), { type: [], categoryId: null });
  assert.deepEqual(
    normalizeAlertFilters({ type: 'low-stock,expiring-soon', categoryId: 'cat-9' }),
    {
      type: [ALERT_TYPES.LOW_STOCK, ALERT_TYPES.EXPIRING_SOON],
      categoryId: 'cat-9'
    }
  );
});

test('describeInventoryAlertSourceShape documents the minimum source shape', () => {
  assert.match(describeInventoryAlertSourceShape(), /productId/);
  assert.match(describeInventoryAlertSourceShape(), /productName/);
  assert.match(describeInventoryAlertSourceShape(), /categoryId/);
  assert.match(describeInventoryAlertSourceShape(), /currentStock/);
  assert.match(describeInventoryAlertSourceShape(), /minStock/);
  assert.match(describeInventoryAlertSourceShape(), /maxStock/);
  assert.match(describeInventoryAlertSourceShape(), /expirationDate/);
});
