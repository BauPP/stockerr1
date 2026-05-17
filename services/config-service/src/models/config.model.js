/**
 * Config key validation and value type coercion.
 *
 * Known keys and their validation rules:
 *   stock_minimo_global   → integer ≥ 0, default 10
 *   dias_expiracion_alertas → integer ≥ 1, default 30
 *   max_intentos_login    → integer ≥ 1, default 3
 *   tiempo_bloqueo_minutos → integer ≥ 1, default 15
 */

const KEY_PATTERN = /^[a-zA-Z0-9_]+$/;

const KNOWN_KEYS = {
  stock_minimo_global: { type: 'integer', default: '10', min: 0 },
  dias_expiracion_alertas: { type: 'integer', default: '30', min: 1 },
  max_intentos_login: { type: 'integer', default: '3', min: 1 },
  tiempo_bloqueo_minutos: { type: 'integer', default: '15', min: 1 },
};

/**
 * Validate a config key format.
 * Keys must be non-empty alphanumeric + underscore.
 * @param {string} key
 * @throws {Error} 400 if invalid
 */
function validateKey(key) {
  if (!key || typeof key !== 'string') {
    const err = new Error('La clave debe ser un texto no vacío');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (!KEY_PATTERN.test(key)) {
    const err = new Error(
      'La clave solo puede contener letras, números y guiones bajos'
    );
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
}

/**
 * Validate a config value for a given key.
 * For known keys, enforces type and range constraints.
 * @param {string} key
 * @param {string} value
 * @throws {Error} 400 if invalid
 */
function validateValue(key, value) {
  if (value === undefined || value === null || value === '') {
    const err = new Error('El valor no puede estar vacío');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const known = KNOWN_KEYS[key];
  if (known) {
    const num = Number(value);
    if (Number.isNaN(num)) {
      const err = new Error(`El valor para ${key} debe ser numérico`);
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    if (num < known.min) {
      const err = new Error(
        `El valor para ${key} debe ser ≥ ${known.min}`
      );
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
  }
}

/**
 * Return all known key → default value mappings.
 * @returns {Object<string, string>}
 */
function getDefaults() {
  const result = {};
  for (const [key, config] of Object.entries(KNOWN_KEYS)) {
    result[key] = config.default;
  }
  return result;
}

/**
 * Return the default value for a single known key.
 * Returns empty string for unknown keys.
 * @param {string} key
 * @returns {string}
 */
function getDefault(key) {
  const known = KNOWN_KEYS[key];
  return known ? known.default : '';
}

/**
 * Check if a key is a known system parameter.
 * @param {string} key
 * @returns {boolean}
 */
function isKnownKey(key) {
  return key in KNOWN_KEYS;
}

module.exports = {
  validateKey,
  validateValue,
  getDefaults,
  getDefault,
  isKnownKey,
  KNOWN_KEYS,
};
