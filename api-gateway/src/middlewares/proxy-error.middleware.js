'use strict';

/**
 * Mapa de errores de red a códigos HTTP para respuestas de proxy.
 *
 * Maneja los escenarios comunes cuando el gateway intenta comunicarse
 * con un microservicio upstream y la conexión falla:
 *
 *   ECONNREFUSED / ENOTFOUND  → 502 Bad Gateway
 *   ETIMEDOUT / timeout       → 504 Gateway Timeout
 *
 * @type {Object<string, number>}
 */
const NETWORK_ERROR_STATUS = {
  ECONNREFUSED: 502,
  ENOTFOUND: 502,
  ETIMEDOUT: 504,
  UND_ERR_CONNECT_TIMEOUT: 504,
};

/**
 * Responde con un código HTTP apropiado según el tipo de error de proxy.
 *
 * Inspecciona `err.cause?.code` para detectar errores de red y mapearlos
 * a los códigos estándar de gateway (502/504). Si el error trae un status
 * propio (ej. 404 del upstream), lo propaga. En caso contrario responde
 * con 500.
 *
 * @param {Error} err   Error lanzado por fetch o por el servicio upstream.
 * @param {object} res  Respuesta Express.
 */
function handleProxyError(err, res) {
  const causeCode = err.cause?.code;
  const knownStatus = NETWORK_ERROR_STATUS[causeCode];

  if (knownStatus) {
    const code = knownStatus === 504 ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE';
    const message =
      knownStatus === 504
        ? 'El servicio upstream no respondió a tiempo'
        : 'El servicio upstream no está disponible';

    return res.status(knownStatus).json({
      success: false,
      error: { code, message },
    });
  }

  // Errores con status propio (ej. 404, 400 propagados desde upstream)
  if (err.status) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code || 'UPSTREAM_ERROR',
        message: err.message || 'Error del servicio upstream',
      },
    });
  }

  // Error desconocido — responder con 500
  return res.status(500).json({
    success: false,
    error: {
      code: 'PROXY_ERROR',
      message: err.message || 'Error interno de comunicación con el servicio',
    },
  });
}

module.exports = { handleProxyError };
