'use strict';

const { Router } = require('express');
const { PERMISOS } = require('../../../shared/constants/roles');

function buildProxyUrl(baseUrl, path) {
  return `${baseUrl}${path}`;
}

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

  const response = await fetchImpl(buildProxyUrl(configServiceUrl, path), {
    method,
    headers,
    body: method === 'PUT' ? JSON.stringify(req.body || {}) : undefined,
  });

  const data = await response.json();
  return res.status(response.status).json(data);
}

function requireRoles(allowedRoles) {
  return function roleGuard(req, res, next) {
    const role = req.authUser?.rol;
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_FORBIDDEN',
          message: 'No tiene permisos para esta operacion',
        },
      });
    }
    return next();
  };
}

function createConfigRoutes({ configServiceUrl, authMiddleware, fetchImpl = fetch }) {
  const router = Router();

  // GET /api/config — Admin + Operador pueden leer
  router.get(
    '/',
    authMiddleware,
    requireRoles(PERMISOS.CONSULTAR_INVENTARIO),
    (req, res, next) =>
      proxyToConfigService(req, res, configServiceUrl, '/api/config', 'GET', fetchImpl).catch(next)
  );

  // PUT /api/config — solo Admin puede escribir
  router.put(
    '/',
    authMiddleware,
    requireRoles(PERMISOS.CONFIGURAR_SISTEMA),
    (req, res, next) =>
      proxyToConfigService(req, res, configServiceUrl, '/api/config', 'PUT', fetchImpl).catch(next)
  );

  return router;
}

module.exports = { createConfigRoutes };
