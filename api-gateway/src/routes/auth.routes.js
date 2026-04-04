'use strict';

const express = require('express');
const axios = require('axios');

const { authService } = require('../config/services');
const authMiddleware = require('../middlewares/auth.middleware');
const { AppError } = require('../../../shared/middlewares/errorHandler');

const router = express.Router();

const authClient = axios.create({
  baseURL: authService.baseUrl,
  timeout: 5000,
});

function mapAxiosError(error) {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data || {};

    return new AppError(
      data.message ||
        data.mensaje ||
        data.error ||
        'Error en el servicio de autenticacion.',
      status,
      data.details
    );
  }

  if (error.request) {
    return new AppError(
      'No fue posible comunicarse con el servicio de autenticacion.',
      503
    );
  }

  return new AppError(
    error.message || 'Error interno del API Gateway.',
    500
  );
}


router.post('/login', async (req, res, next) => {
  try {
    const serviceResponse = await authClient.post('/api/auth/login', req.body);

    // Se devuelve tal cual para no romper el contrato del MS-01
    return res.status(serviceResponse.status).json(serviceResponse.data);
  } catch (error) {
    return next(mapAxiosError(error));
  }
});

router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const serviceResponse = await authClient.post(
      '/api/auth/logout',
      {},
      {
        headers: {
          Authorization: req.headers.authorization,
        },
      }
    );

    return res.status(serviceResponse.status).json(serviceResponse.data);
  } catch (error) {
    return next(mapAxiosError(error));
  }
});

router.post('/refresh', authMiddleware, async (req, res, next) => {
  try {
    const serviceResponse = await authClient.post(
      '/api/auth/refresh',
      {},
      {
        headers: {
          Authorization: req.headers.authorization,
        },
      }
    );

    return res.status(serviceResponse.status).json(serviceResponse.data);
  } catch (error) {
    return next(mapAxiosError(error));
  }
});

module.exports = router;