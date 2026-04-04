'use strict';

const axios = require('axios');
const { unauthorized } = require('../../../shared/utils/response');
const { AppError } = require('../../../shared/middlewares/errorHandler');
const { authService } = require('../config/services');

const authClient = axios.create({
  baseURL: authService.baseUrl,
  timeout: 5000,
});

module.exports = async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized(res, 'Token ausente o invalido');
    }

    const serviceResponse = await authClient.get('/api/auth/verify', {
      headers: {
        Authorization: authHeader,
      },
    });

    const data = serviceResponse.data || {};

    req.user = data.usuario || data;

    return next();
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data || {};

      return next(
        new AppError(
          data.message ||
            data.mensaje ||
            data.error ||
            'Token expirado o invalido',
          status
        )
      );
    }

    if (error.request) {
      return next(
        new AppError(
          'No fue posible comunicarse con el servicio de autenticacion.',
          503
        )
      );
    }

    return next(
      new AppError(
        error.message || 'Error interno validando el token.',
        500
      )
    );
  }
};