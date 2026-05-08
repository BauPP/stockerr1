const {
  validateKey,
  validateValue,
  getDefaults,
  getDefault,
} = require('../models/config.model');

class ConfigService {
  constructor({ repository }) {
    this.repository = repository;
  }

  /**
   * Get config value(s).
   * @param {string} [key] - Optional key. If omitted, returns all params.
   * @returns {Promise<Object>} Single param object or all params as key-value map.
   */
  async getConfig(key) {
    if (key !== undefined) {
      const param = await this.repository.getByKey(key);
      if (!param) {
        return {
          clave: key,
          valor: getDefault(key),
          configurado: false,
        };
      }
      return {
        clave: param.clave,
        valor: param.valor,
        configurado: true,
      };
    }

    // Return all known keys with DB values (or defaults)
    const dbParams = await this.repository.getAll();
    const dbMap = {};
    for (const p of dbParams) {
      dbMap[p.clave] = p.valor;
    }

    const defaults = getDefaults();
    const result = {};
    for (const [key, defaultVal] of Object.entries(defaults)) {
      result[key] = dbMap[key] || defaultVal;
    }

    // Include any extra DB params not in known keys
    for (const [dbKey, dbVal] of Object.entries(dbMap)) {
      if (!(dbKey in defaults)) {
        result[dbKey] = dbVal;
      }
    }

    return result;
  }

  /**
   * Update (create or overwrite) a config parameter.
   * @param {string} key
   * @param {string} value
   * @returns {Promise<Object>} { clave, valor_anterior, valor_nuevo }
   */
  async updateConfig(key, value) {
    validateKey(key);
    validateValue(key, value);

    const old = await this.repository.getByKey(key);
    const oldValue = old ? old.valor : null;

    const updated = await this.repository.upsert(key, value);

    return {
      clave: updated.clave,
      valor_anterior: oldValue,
      valor_nuevo: updated.valor,
    };
  }
}

module.exports = { ConfigService };
