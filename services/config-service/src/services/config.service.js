'use strict';

const VALID_KEY_REGEX = /^[a-z_][a-z0-9_]*$/;

class ConfigService {
  constructor({ repository }) {
    this.repository = repository;
  }

  _createError(status, code, message) {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
  }

  validateKey(clave) {
    if (!clave || typeof clave !== 'string' || !clave.trim()) {
      throw this._createError(400, 'VALIDATION_ERROR', 'La clave de configuración es obligatoria');
    }
    if (!VALID_KEY_REGEX.test(clave)) {
      throw this._createError(400, 'INVALID_KEY_FORMAT', 'Formato de clave inválido');
    }
    return clave.trim();
  }

  validateValue(valor) {
    if (typeof valor === 'undefined' || valor === null || valor === '') {
      throw this._createError(400, 'VALIDATION_ERROR', 'El valor de configuración es obligatorio');
    }
    return String(valor);
  }

  async getAll() {
    const configs = await this.repository.getAll();
    return { data: configs };
  }

  async updateBulkConfig(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw this._createError(400, 'VALIDATION_ERROR', 'El cuerpo debe ser un objeto con pares clave:valor');
    }

    const keys = Object.keys(payload);
    if (keys.length === 0) {
      throw this._createError(400, 'VALIDATION_ERROR', 'Debe enviar al menos una clave de configuración');
    }

    const updated = [];
    const errors = [];

    for (const [clave, valor] of Object.entries(payload)) {
      try {
        const validKey = this.validateKey(clave);
        const validValue = this.validateValue(valor);
        await this.repository.upsert(validKey, validValue);
        updated.push(validKey);
      } catch (error) {
        errors.push({ clave, error: error.message });
      }
    }

    return { data: { updated, errors } };
  }
}

module.exports = { ConfigService };
