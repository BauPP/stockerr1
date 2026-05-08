'use strict';

/**
 * Rutas del API Gateway hacia el barcode-service (MS-08).
 *
 * Proxy a barcode-service en puerto 3007. La autorización se aplica antes del
 * proxy: Admin y Operador pueden consultar y validar; solo Admin puede generar.
 *
 * Convención del proxy:
 *   - El gateway expone /api/barcodes/* (estándar del proyecto).
 *   - El barcode-service expone:
 *       GET  /api/barcodes/:code    → lookup
 *       POST /api/barcodes/validate → validación EAN-13
 *       POST /api/barcodes/generate → generación (Admin only)
 *   - El gateway reenvía el path y método tal cual, propagando el JWT.
 */

const { Router } = require('express');

const { ADMINISTRADOR, OPERADOR } = require('../../../shared/constants/roles');
const { requireRoles } = require('../middlewares/role.middleware');

/**
 * Construye URL de proxy preservando query params.
 */
function buildProxyUrl(baseUrl, path, query) {
  const searchParams = new URLSearchParams();

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, value);
    }
  });

  const queryString = searchParams.toString();
  return `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
}

/**
 * Reenvía la petición al barcode-service propagando JWT y headers de auditoría.
 */
async function proxyToBarcodeService(req, res, barcodeServiceUrl, path, method, fetchImpl) {
  const headers = { 'Content-Type': 'application/json' };
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }
  if (req.authUser?.id_usuario) {
    headers['x-user-id'] = String(req.authUser.id_usuario);
  }
  if (req.authUser?.rol) {
    headers['x-user-role'] = String(req.authUser.rol);
  }
  if (req.authUser?.nombre) {
    headers['x-user-name'] = String(req.authUser.nombre);
  }

  const response = await fetchImpl(buildProxyUrl(barcodeServiceUrl, path, req.query), {
    method,
    headers,
    body: method === 'POST' || method === 'PUT' ? JSON.stringify(req.body || {}) : undefined,
  });

  const data = await response.json();
  return res.status(response.status).json(data);
}

/**
 * Crea el router del API Gateway para el dominio /api/barcodes.
 *
 * @param {object} options
 * @param {string} options.barcodeServiceUrl  Base URL del barcode-service.
 * @param {Function} options.authMiddleware   Middleware de validación de JWT.
 * @param {Function} [options.fetchImpl=fetch] Implementación de fetch inyectable.
 * @returns {object} Express Router
 */
function createBarcodeRoutes({ barcodeServiceUrl, authMiddleware, fetchImpl = fetch } = {}) {
  const router = Router();

  // GET /:code — lookup por código de barras (Admin + Operador)
  router.get(
    '/:code',
    authMiddleware,
    requireRoles([ADMINISTRADOR, OPERADOR]),
    async (req, res) => {
      try {
        await proxyToBarcodeService(
          req,
          res,
          barcodeServiceUrl,
          `/api/barcodes/${req.params.code}`,
          'GET',
          fetchImpl
        );
      } catch (_error) {
        return res.status(502).json({
          success: false,
          error: {
            code: 'BAD_GATEWAY',
            message: 'Barcode service no disponible',
          },
        });
      }
    }
  );

  // POST /validate — validar formato EAN-13 (Admin + Operador)
  router.post(
    '/validate',
    authMiddleware,
    requireRoles([ADMINISTRADOR, OPERADOR]),
    async (req, res) => {
      try {
        await proxyToBarcodeService(
          req,
          res,
          barcodeServiceUrl,
          '/api/barcodes/validate',
          'POST',
          fetchImpl
        );
      } catch (_error) {
        return res.status(502).json({
          success: false,
          error: {
            code: 'BAD_GATEWAY',
            message: 'Barcode service no disponible',
          },
        });
      }
    }
  );

  // POST /generate — generar códigos EAN-13 válidos (solo Admin)
  router.post(
    '/generate',
    authMiddleware,
    requireRoles([ADMINISTRADOR]),
    async (req, res) => {
      try {
        await proxyToBarcodeService(
          req,
          res,
          barcodeServiceUrl,
          '/api/barcodes/generate',
          'POST',
          fetchImpl
        );
      } catch (_error) {
        return res.status(502).json({
          success: false,
          error: {
            code: 'BAD_GATEWAY',
            message: 'Barcode service no disponible',
          },
        });
      }
    }
  );

  return router;
}

module.exports = { createBarcodeRoutes };
