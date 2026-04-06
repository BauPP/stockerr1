function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function validateLoginPayload(body) {
  if (!body || typeof body !== 'object') {
    throw createHttpError(400, 'VALIDATION_ERROR', 'El cuerpo de la solicitud es obligatorio');
  }

  const { nombre_usuario, contrasena } = body;
  if (!nombre_usuario || !contrasena) {
    throw createHttpError(
      400,
      'VALIDATION_ERROR',
      'nombre_usuario y contrasena son obligatorios'
    );
  }

  return { nombre_usuario, contrasena };
}

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== 'string') {
    throw createHttpError(401, 'AUTH_TOKEN_MISSING', 'Token de autorización no proporcionado');
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw createHttpError(401, 'AUTH_TOKEN_INVALID', 'Formato de token inválido');
  }

  return token;
}

module.exports = {
  createHttpError,
  validateLoginPayload,
  extractBearerToken,
};
