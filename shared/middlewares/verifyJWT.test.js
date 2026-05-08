'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createVerifyJWT } = require('./verifyJWT');

function mockResponse() {
  const res = {};
  res.status = (code) => {
    res._status = code;
    return res;
  };
  res.json = (body) => {
    res._body = body;
    return res;
  };
  return res;
}

test('returns 401 when no Authorization header', async () => {
  const middleware = createVerifyJWT({ authServiceUrl: 'http://auth:3002' });
  const req = { headers: {} };
  const res = mockResponse();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.equal(res._status, 401);
  assert.equal(res._body.error.code, 'AUTH_TOKEN_MISSING');
  assert.equal(nextCalled, false, 'next must not be called when token is missing');
});

test('returns 503 when auth service is unreachable', async () => {
  const mockFetch = async () => {
    throw new Error('fetch failed');
  };
  const middleware = createVerifyJWT({
    authServiceUrl: 'http://auth:3002',
    fetchImpl: mockFetch,
  });
  const req = { headers: { authorization: 'Bearer some-token' } };
  const res = mockResponse();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.equal(res._status, 503);
  assert.equal(res._body.error.code, 'AUTH_SERVICE_UNAVAILABLE');
  assert.equal(nextCalled, false, 'next must not be called when auth is down');
});

test('returns 401 when auth service responds with !ok', async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({
      success: false,
      error: { code: 'AUTH_TOKEN_EXPIRED', message: 'El token ha expirado' },
    }),
  });
  const middleware = createVerifyJWT({
    authServiceUrl: 'http://auth:3002',
    fetchImpl: mockFetch,
  });
  const req = { headers: { authorization: 'Bearer expired-token' } };
  const res = mockResponse();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.equal(res._status, 401);
  assert.equal(res._body.error.code, 'AUTH_TOKEN_EXPIRED');
  assert.equal(nextCalled, false, 'next must not be called with invalid token');
});

test('sets req.authUser and calls next() when token is valid', async () => {
  const authUserData = {
    valid: true,
    id_usuario: 1,
    rol: 'Administrador',
    nombre: 'Admin Demo',
  };
  const mockFetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer valid-jwt');
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: authUserData }),
    };
  };
  const middleware = createVerifyJWT({
    authServiceUrl: 'http://auth:3002',
    fetchImpl: mockFetch,
  });
  const req = { headers: { authorization: 'Bearer valid-jwt' } };
  const res = mockResponse();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true, 'next must be called for valid token');
  assert.deepEqual(req.authUser, authUserData);
});
