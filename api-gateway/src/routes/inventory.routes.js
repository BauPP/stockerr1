'use strict';

/**
 * Rutas del API Gateway hacia el inventory-service (MS-05).
 *
 * Este archivo unifica el trabajo de dos historias:
 *   - MS-06 (Alertas de stock):    GET /api/inventory/alerts
 *   - MS-09 (Movimientos auditados): GET y POST /api/inventory/movements
 *
 * Convención del proxy:
 *   - El gateway expone TODAS sus rutas bajo /api/* (estándar del proyecto).
 *   - El inventory-service expone:
 *       /inventory/alerts         (rama MS-06: stock alerts)
 *       /api/inventory/movements  (rama MS-09: movimientos)
 *     porque históricamente ambas historias se desarrollaron por separado y
 *     cada una eligió su propio prefijo. El gateway absorbe esa diferencia.
 *
 * Reglas de autorización (Requisito R02):
 *   - Consultar alertas y movimientos: Administrador y Operador.
 *   - Registrar movimientos:           Administrador y Operador.
 *
 * Las dos rutas requieren JWT válido. Esa validación la hace el authMiddleware,
 * que llama internamente a /api/auth/verify del auth-service.
 */

const { Router } = require('express');

const { ADMINISTRADOR, OPERADOR } = require('../../../shared/constants/roles');
const { requireRoles } = require('../middlewares/role.middleware');

/**
 * Construye una URL upstream con query string preservada.
 *
 * Filtra valores undefined / null / '' para no ensuciar la URL con parámetros
 * vacíos cuando el cliente no los envía.
 */
function buildProxyUrl(baseUrl, path, query = {}) {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

/**
 * Reenvía la respuesta del servicio upstream conservando status, content-type
 * y cuerpo. Si el upstream responde JSON, lo parseamos y volvemos a serializar
 * con res.json para garantizar headers correctos.
 */
async function sendProxyResponse(upstreamResponse, res) {
  const text = await upstreamResponse.text();
  const contentType =
    upstreamResponse.headers?.get?.('content-type') || 'application/json';

  res.status(upstreamResponse.status);

  if (contentType.includes('application/json')) {
    res.json(text ? JSON.parse(text) : {});
    return;
  }

  res.type(contentType).send(text);
}

/**
 * Forwardea la petición al inventory-service propagando el JWT y los headers
 * x-user-* que el servicio downstream usa para auditoría sin tener que volver
 * a parsear el token.
 *
 * Nota: el inventory-service también valida el token contra el auth-service
 * (zero-trust), pero los headers x-user-* le ahorran ese roundtrip cuando
 * solo necesita identificar al actor para registrar el movimiento.
 */
async function proxyToInventory({
  req,
  res,
  upstreamUrl,
  method,
  fetchImpl,
}) {
  const headers = { 'Content-Type': 'application/json', accept: 'application/json' };

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

  const upstreamResponse = await fetchImpl(upstreamUrl, {
    method,
    headers,
    body: method === 'POST' || method === 'PUT' ? JSON.stringify(req.body || {}) : undefined,
  });

  await sendProxyResponse(upstreamResponse, res);
}

/**
 * Crea el router del API Gateway para el dominio /api/inventory.
 *
 * @param {object} options
 * @param {string} options.inventoryServiceUrl  Base URL del inventory-service.
 * @param {Function} [options.authMiddleware]   Middleware de validación de JWT.
 *   Si no se pasa, las rutas quedan SIN protección (modo legacy de MS-06 puro,
 *   solo útil para tests aislados con fetch mockeado).
 * @param {Function} [options.fetchImpl=fetch]  Implementación de fetch
 *   (inyectable para tests).
 */
function createInventoryRouter({ inventoryServiceUrl, authMiddleware, fetchImpl = fetch } = {}) {
  const router = Router();

  // --- En modo "legacy MS-06" (sin authMiddleware) las rutas son públicas. -
  // Esto preserva la compatibilidad con inventory-alerts.proxy.test.js, que
  // construye la app con createApp({ fetchImpl }) y mockea el upstream.
  const guards = authMiddleware
    ? [authMiddleware, requireRoles([ADMINISTRADOR, OPERADOR])]
    : [];

  // ---------------------------------------------------------------------------
  // MS-06 — Alertas de stock
  // ---------------------------------------------------------------------------
  // El inventory-service publica este endpoint en /inventory/alerts (sin /api),
  // por compatibilidad histórica con la rama MS-06.
  router.get('/alerts', ...guards, async (req, res) => {
    try {
      const upstreamUrl = buildProxyUrl(
        inventoryServiceUrl,
        '/inventory/alerts',
        req.query
      );
      const upstreamResponse = await fetchImpl(upstreamUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...(req.headers.authorization
            ? { Authorization: req.headers.authorization }
            : {}),
        },
      });

      await sendProxyResponse(upstreamResponse, res);
    } catch (_error) {
      res.status(502).json({ error: 'Inventory service unavailable' });
    }
  });

  // ---------------------------------------------------------------------------
  // MS-09 — Movimientos de inventario (con auditoría)
  // ---------------------------------------------------------------------------
  // El inventory-service de la rama MS-09 publica esto en /api/inventory/movements.
  // Cada movimiento registrado dispara un webhook al audit-service, completando
  // el flujo: acción → registro en auditoría.
  router.get('/movements', ...guards, async (req, res, next) => {
    try {
      const upstreamUrl = buildProxyUrl(
        inventoryServiceUrl,
        '/api/inventory/movements',
        req.query
      );
      await proxyToInventory({
        req,
        res,
        upstreamUrl,
        method: 'GET',
        fetchImpl,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/movements', ...guards, async (req, res, next) => {
    try {
      const upstreamUrl = buildProxyUrl(
        inventoryServiceUrl,
        '/api/inventory/movements',
        req.query
      );
      await proxyToInventory({
        req,
        res,
        upstreamUrl,
        method: 'POST',
        fetchImpl,
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  buildProxyUrl,
  createInventoryRouter,
  sendProxyResponse,
};
