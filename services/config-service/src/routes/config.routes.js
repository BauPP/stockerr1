const { Router } = require('express');

/**
 * Create config routes with optional auth middleware.
 *
 * @param {object} controller - ConfigController instance
 * @param {object} [options]
 * @param {Function} [options.authMiddleware] - JWT auth middleware (applied to PUT)
 * @param {Function} [options.adminOnly] - Admin role guard (applied to PUT after auth)
 * @returns {object} Express Router
 */
function createConfigRoutes(controller, options = {}) {
  const router = Router();
  const { authMiddleware, adminOnly } = options;

  // GET /api/config — all params
  router.get('/', controller.getConfig);

  // GET /api/config/:key — single param
  router.get('/:key', controller.getConfig);

  // PUT /api/config/:key — update param (requires auth + admin when configured)
  if (authMiddleware && adminOnly) {
    router.put('/:key', authMiddleware, adminOnly, controller.updateConfig);
  } else if (authMiddleware) {
    router.put('/:key', authMiddleware, controller.updateConfig);
  } else {
    router.put('/:key', controller.updateConfig);
  }

  return router;
}

module.exports = { createConfigRoutes };
