'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handleProxyError } = require('../src/middlewares/proxy-error.middleware');

function mockResponse() {
  const chunks = [];
  let statusCode = 200;
  const res = {
    _getStatus: () => statusCode,
    _getJSON: () => (chunks.length > 0 ? JSON.parse(chunks[0]) : null),
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      chunks.push(JSON.stringify(data));
      return res;
    },
  };
  return res;
}

test('handleProxyError returns 502 for ECONNREFUSED', () => {
  const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3001'), {
    cause: { code: 'ECONNREFUSED', errno: -4078 },
  });
  const res = mockResponse();
  handleProxyError(err, res);
  assert.equal(res._getStatus(), 502);
  assert.equal(res._getJSON().error.code, 'UPSTREAM_UNAVAILABLE');
});

test('handleProxyError returns 502 for ENOTFOUND', () => {
  const err = Object.assign(new Error('getaddrinfo ENOTFOUND service-name'), {
    cause: { code: 'ENOTFOUND', errno: -3008 },
  });
  const res = mockResponse();
  handleProxyError(err, res);
  assert.equal(res._getStatus(), 502);
  assert.equal(res._getJSON().error.code, 'UPSTREAM_UNAVAILABLE');
});

test('handleProxyError returns 504 for ETIMEDOUT', () => {
  const err = Object.assign(new Error('fetch timed out'), {
    cause: { code: 'ETIMEDOUT', errno: -4039 },
  });
  const res = mockResponse();
  handleProxyError(err, res);
  assert.equal(res._getStatus(), 504);
  assert.equal(res._getJSON().error.code, 'UPSTREAM_TIMEOUT');
});

test('handleProxyError returns 504 for timeout in message', () => {
  const err = Object.assign(new Error('Timeout awaiting request'), {
    cause: { code: 'UND_ERR_CONNECT_TIMEOUT' },
  });
  const res = mockResponse();
  handleProxyError(err, res);
  assert.equal(res._getStatus(), 504);
  assert.equal(res._getJSON().error.code, 'UPSTREAM_TIMEOUT');
});

test('handleProxyError propagates status for upstream errors', () => {
  const err = Object.assign(new Error('Not found'), { status: 404, code: 'NOT_FOUND' });
  const res = mockResponse();
  handleProxyError(err, res);
  assert.equal(res._getStatus(), 404);
  assert.equal(res._getJSON().error.code, 'NOT_FOUND');
});

test('handleProxyError returns 500 for unknown errors', () => {
  const err = new Error('Something weird happened');
  const res = mockResponse();
  handleProxyError(err, res);
  assert.equal(res._getStatus(), 500);
  assert.equal(res._getJSON().error.code, 'PROXY_ERROR');
});
