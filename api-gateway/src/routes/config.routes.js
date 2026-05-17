'use strict';

/**
 * Rutas del API Gateway hacia el config-service (MS-11).
 *
 * Proxy a config-service en puerto 3008. La autorización se aplica antes del
 * proxy: Admin y Operador pueden consultar; solo Admin puede modificar.
 *
 * Convención del proxy:
 *   - El gateway expone /api/config/* (estándar del proyecto).
 *   - El config-service expone:
 *       GET  /api/config       → todos los parámetros
 *       GET  /api/config/:key  → un parámetro específico
 *       PUT  /api/config/:key  → crear o actualizar (Admin only)
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
 * Reenvía la petición al config-service propagando JWT y headers de auditoría.
 */
async function proxyToConfigService(req, res, configServiceUrl, path, method, fetchImpl) {
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

  const response = await fetchImpl(buildProxyUrl(configServiceUrl, path, req.query), {
    method,
    headers,
    body: method === 'POST' || method === 'PUT' ? JSON.stringify(req.body || {}) : undefined,
  });

  const data = await response.json();
  return res.status(response.status).json(data);
}

/**
 * Crea el router del API Gateway para el dominio /api/config.
 *
 * @param {object} options
 * @param {string} options.configServiceUrl   Base URL del config-service.
 * @param {Function} options.authMiddleware   Middleware de validación de JWT.
 * @param {Function} [options.fetchImpl=fetch] Implementación de fetch inyectable.
 * @returns {object} Express Router
 */
function createConfigRoutes({ configServiceUrl, authMiddleware, fetchImpl = fetch } = {}) {
  const router = Router();

  // GET / — todos los parámetros (Admin + Operador)
  router.get(
    '/',
    authMiddleware,
    requireRoles([ADMINISTRADOR, OPERADOR]),
    async (req, res) => {
      try {
        await proxyToConfigService(
          req,
          res,
          configServiceUrl,
          '/api/config',
          'GET',
          fetchImpl
        );
      } catch (_error) {
        return res.status(502).json({
          success: false,
          error: {
            code: 'BAD_GATEWAY',
            message: 'Config service no disponible',
          },
        });
      }
    }
  );

  // GET /:key — un parámetro específico (Admin + Operador)
  router.get(
    '/:key',
    authMiddleware,
    requireRoles([ADMINISTRADOR, OPERADOR]),
    async (req, res) => {
      try {
        await proxyToConfigService(
          req,
          res,
          configServiceUrl,
          `/api/config/${req.params.key}`,
          'GET',
          fetchImpl
        );
      } catch (_error) {
        return res.status(502).json({
          success: false,
          error: {
            code: 'BAD_GATEWAY',
            message: 'Config service no disponible',
          },
        });
      }
    }
  );

  // PUT /:key — crear o actualizar (solo Admin)
  router.put(
    '/:key',
    authMiddleware,
    requireRoles([ADMINISTRADOR]),
    async (req, res) => {
      try {
        await proxyToConfigService(
          req,
          res,
          configServiceUrl,
          `/api/config/${req.params.key}`,
          'PUT',
          fetchImpl
        );
      } catch (_error) {
        return res.status(502).json({
          success: false,
          error: {
            code: 'BAD_GATEWAY',
            message: 'Config service no disponible',
          },
        });
      }
    }
  );

  return router;
}

module.exports = { createConfigRoutes };
