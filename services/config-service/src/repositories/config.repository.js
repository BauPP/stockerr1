'use strict';

class InMemoryConfigRepository {
  constructor({ configs = {} } = {}) {
    this.configs = { ...configs };
  }

  async getAll() {
    return { ...this.configs };
  }

  async upsert(clave, valor) {
    this.configs[clave] = valor;
    return { clave, valor };
  }

  async getByKey(clave) {
    return this.configs[clave] || null;
  }
}

module.exports = { InMemoryConfigRepository };
