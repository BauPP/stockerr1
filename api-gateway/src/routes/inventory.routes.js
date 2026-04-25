const express = require('express');

function buildUpstreamUrl(baseUrl, path, query = {}) {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

async function sendProxyResponse(upstreamResponse, res) {
  const text = await upstreamResponse.text();
  const contentType = upstreamResponse.headers?.get?.('content-type') || 'application/json';

  res.status(upstreamResponse.status);

  if (contentType.includes('application/json')) {
    res.json(text ? JSON.parse(text) : {});
    return;
  }

  res.type(contentType).send(text);
}

function createInventoryRouter({ fetchImpl = fetch, servicesConfig }) {
  const router = express.Router();

  router.get('/alerts', async (req, res) => {
    try {
      const url = buildUpstreamUrl(servicesConfig.inventoryServiceUrl, '/inventory/alerts', req.query);
      const upstreamResponse = await fetchImpl(url, {
        method: 'GET',
        headers: {
          accept: 'application/json'
        }
      });

      await sendProxyResponse(upstreamResponse, res);
    } catch (_error) {
      res.status(502).json({ error: 'Inventory service unavailable' });
    }
  });

  return router;
}

module.exports = {
  buildUpstreamUrl,
  createInventoryRouter,
  sendProxyResponse
};
