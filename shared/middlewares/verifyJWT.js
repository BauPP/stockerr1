'use strict';

/**
 * @fileoverview Middleware JWT zero-trust para microservicios.
 * Verifica cada request contra el auth-service vía HTTP.
 * NO confía en tokens locales ni headers propagados.
 *
 * Uso: app.use('/api/*', createVerifyJWT({ authServiceUrl }), routes);
 *
 * @module shared/middlewares/verifyJWT
 */

/**
 * Crea middleware que valida JWT contra el auth-service en cada request.
 *
 * @param {Object} options
 * @param {string} options.authServiceUrl - URL base del auth-service (ej. http://auth-service:3002)
 * @param {Function} [options.fetchImpl] - Implementación de fetch (para inyección en tests)
 * @returns {Function} Middleware Express (req, res, next)
 */
function createVerifyJWT({ authServiceUrl, fetchImpl = fetch }) {
  return async function verifyJWT(req, res, next) {
    try {
      const authorization = req.headers.authorization;
      if (!authorization) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_TOKEN_MISSING',
            message: 'Token de autorización no proporcionado',
          },
        });
      }

      const response = await fetchImpl(`${authServiceUrl}/api/auth/verify`, {
        method: 'GET',
        headers: { Authorization: authorization },
      });

      const payload = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(payload);
      }

      req.authUser = payload.data;
      return next();
    } catch (_error) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AUTH_SERVICE_UNAVAILABLE',
          message:
            'No fue posible validar el token con el servicio de autenticación',
        },
      });
    }
  };
}

module.exports = { createVerifyJWT };
