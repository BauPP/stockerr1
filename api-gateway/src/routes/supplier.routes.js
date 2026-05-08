'use strict';

/**
 * Rutas placeholder para supplier-service (MS-10).
 *
 * MS-10 aún no está implementado. Este router expone el prefijo
 * /api/suppliers como proxy hacia supplier-service en puerto 3009,
 * devolviendo 503 cuando el servicio destino no está disponible.
 */

const { Router } = require('express');

function createSupplierRoutes({ supplierServiceUrl, authMiddleware, fetchImpl = fetch } = {}) {
  const router = Router();

  // GET / — placeholder proxy a supplier-service
  router.get('/', authMiddleware, async (req, res, next) => {
    try {
      const response = await fetchImpl(`${supplierServiceUrl}/api/suppliers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
          ...(req.headers.authorization
            ? { Authorization: req.headers.authorization }
            : {}),
        },
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } catch (_error) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Supplier service no disponible',
        },
      });
    }
  });

  return router;
}

module.exports = { createSupplierRoutes };
