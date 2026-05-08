const { Router } = require('express');
const { handleProxyError } = require('../middlewares/proxy-error.middleware');

async function proxyToAuthService(req, res, authServiceUrl, endpoint, method, fetchImpl) {
  const headers = { 'Content-Type': 'application/json' };
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }

  const response = await fetchImpl(`${authServiceUrl}${endpoint}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(req.body || {}),
  });

  const data = await response.json();
  return res.status(response.status).json(data);
}

function createAuthRoutes({ authServiceUrl, fetchImpl = fetch } = {}) {
  const router = Router();

  router.post('/login', (req, res) =>
    proxyToAuthService(req, res, authServiceUrl, '/api/auth/login', 'POST', fetchImpl)
      .catch((err) => handleProxyError(err, res))
  );

  router.post('/logout', (req, res) =>
    proxyToAuthService(req, res, authServiceUrl, '/api/auth/logout', 'POST', fetchImpl)
      .catch((err) => handleProxyError(err, res))
  );

  router.post('/refresh', (req, res) =>
    proxyToAuthService(req, res, authServiceUrl, '/api/auth/refresh', 'POST', fetchImpl)
      .catch((err) => handleProxyError(err, res))
  );

  router.get('/verify', (req, res) =>
    proxyToAuthService(req, res, authServiceUrl, '/api/auth/verify', 'GET', fetchImpl)
      .catch((err) => handleProxyError(err, res))
  );

  return router;
}

module.exports = { createAuthRoutes };
