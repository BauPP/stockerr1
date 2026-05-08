/**
 * Config Repository
 *
 * PgConfigRepository: queries `parametros_sistema` table via pg pool.
 * InMemoryConfigRepository: in-memory store for tests.
 * Both implement: getAll(), getByKey(key), upsert(key, value)
 */

class PgConfigRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async getAll() {
    const { rows } = await this.pool.query(
      'SELECT clave, valor, updated_at FROM parametros_sistema ORDER BY clave'
    );
    return rows;
  }

  async getByKey(key) {
    const { rows } = await this.pool.query(
      'SELECT clave, valor, updated_at FROM parametros_sistema WHERE clave = $1',
      [key]
    );
    return rows[0] || null;
  }

  async upsert(key, value) {
    const { rows } = await this.pool.query(
      `INSERT INTO parametros_sistema (clave, valor, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (clave) DO UPDATE
         SET valor = $2, updated_at = NOW()
       RETURNING clave, valor, updated_at`,
      [key, value]
    );
    return rows[0];
  }
}

class InMemoryConfigRepository {
  constructor(initial = {}) {
    this.params = { ...initial };
  }

  async getAll() {
    return Object.entries(this.params).map(([clave, valor]) => ({
      clave,
      valor,
      updated_at: new Date().toISOString(),
    }));
  }

  async getByKey(key) {
    if (key in this.params) {
      return {
        clave: key,
        valor: this.params[key],
        updated_at: new Date().toISOString(),
      };
    }
    return null;
  }

  async upsert(key, value) {
    this.params[key] = value;
    return {
      clave: key,
      valor: value,
      updated_at: new Date().toISOString(),
    };
  }
}

module.exports = {
  PgConfigRepository,
  InMemoryConfigRepository,
};
