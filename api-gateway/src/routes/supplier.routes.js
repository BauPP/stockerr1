'use strict';

/**
 * Rutas del API Gateway hacia el supplier-service (MS-10).
 *
 * MS-10 no está implementado aún. Esta ruta existe como placeholder
 * para que futuros PRs tengan un punto de montaje listo. Responde 501
 * en todas las operaciones.
 */

const { Router } = require('express');

function createSupplierRoutes(_options = {}) {
  const router = Router();

  router.all('/', (_req, res) => {
    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'El servicio de proveedores (MS-10) no está implementado aún',
      },
    });
  });

  return router;
}

module.exports = { createSupplierRoutes };
