class PgProductRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async createProduct({ id_categoria, nombre, codigo, codigo_barras, precio_compra, precio_venta, estado }) {
    const query = `
      INSERT INTO productos (id_categoria, nombre, codigo, codigo_barras, precio_compra, precio_venta, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const { rows } = await this.pool.query(query, [
      id_categoria,
      nombre,
      codigo,
      codigo_barras,
      precio_compra,
      precio_venta,
      estado,
    ]);

    return rows[0] || null;
  }

  async getProductById(idProducto, { includeInactive = false } = {}) {
    const params = [idProducto];
    const filters = ['id_producto = $1'];

    if (!includeInactive) {
      filters.push('estado = true');
    }

    const query = `
      SELECT *
      FROM productos
      WHERE ${filters.join(' AND ')}
      LIMIT 1
    `;

    const { rows } = await this.pool.query(query, params);
    return rows[0] || null;
  }

  async getProductByBarcode(codigoBarras) {
    const query = `
      SELECT *
      FROM productos
      WHERE codigo_barras = $1
      LIMIT 1
    `;

    const { rows } = await this.pool.query(query, [codigoBarras]);
    return rows[0] || null;
  }

  async getCategoryById(idCategoria) {
    const query = `
      SELECT *
      FROM categorias
      WHERE id_categoria = $1
      LIMIT 1
    `;

    const { rows } = await this.pool.query(query, [idCategoria]);
    return rows[0] || null;
  }

  async listProducts({ page, size, name, category, code }) {
    const offset = (page - 1) * size;
    const filters = ['estado = true'];
    const params = [];

    if (name) {
      params.push(`%${name}%`);
      filters.push(`LOWER(nombre) LIKE LOWER($${params.length})`);
    }

    if (typeof category === 'number') {
      params.push(category);
      filters.push(`id_categoria = $${params.length}`);
    }

    if (code) {
      params.push(`%${code}%`);
      filters.push(`LOWER(codigo) LIKE LOWER($${params.length})`);
    }

    const whereClause = `WHERE ${filters.join(' AND ')}`;
    const countResult = await this.pool.query(
      `SELECT COUNT(*)::int AS total FROM productos ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    params.push(size);
    params.push(offset);

    const query = `
      SELECT *
      FROM productos
      ${whereClause}
      ORDER BY id_producto ASC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const { rows } = await this.pool.query(query, params);
    return { total, page, size, items: rows };
  }

  async updateProductPartial(idProducto, patch = {}) {
    const mapping = {
      id_categoria: 'id_categoria',
      nombre: 'nombre',
      codigo: 'codigo',
      precio_compra: 'precio_compra',
      precio_venta: 'precio_venta',
      estado: 'estado',
    };

    const updates = [];
    const values = [];

    Object.entries(patch).forEach(([key, value]) => {
      const column = mapping[key];
      if (!column) {
        return;
      }

      values.push(value);
      updates.push(`${column} = $${values.length}`);
    });

    if (updates.length === 0) {
      return this.getProductById(idProducto, { includeInactive: true });
    }

    values.push(idProducto);

    const query = `
      UPDATE productos
      SET ${updates.join(', ')}
      WHERE id_producto = $${values.length}
      RETURNING *
    `;

    const { rows } = await this.pool.query(query, values);
    return rows[0] || null;
  }

  async softDeleteProduct(idProducto) {
    return this.updateProductPartial(idProducto, { estado: false });
  }
}

class InMemoryProductRepository {
  constructor({ products = [], categories = [] } = {}) {
    this.products = products.map((product) => ({ ...product }));
    this.categories = categories.map((category) => ({ ...category }));
    this.nextId =
      this.products.length > 0
        ? Math.max(...this.products.map((product) => product.id_producto || 0)) + 1
        : 1;
  }

  async createProduct(payload) {
    const product = {
      id_producto: this.nextId,
      ...payload,
    };

    this.products.push(product);
    this.nextId += 1;
    return { ...product };
  }

  async getProductById(idProducto, { includeInactive = false } = {}) {
    const product = this.products.find(
      (item) => item.id_producto === idProducto && (includeInactive || item.estado === true)
    );

    return product ? { ...product } : null;
  }

  async getProductByBarcode(codigoBarras) {
    const product = this.products.find((item) => item.codigo_barras === codigoBarras);
    return product ? { ...product } : null;
  }

  async getCategoryById(idCategoria) {
    const category = this.categories.find((item) => item.id_categoria === idCategoria);
    return category ? { ...category } : null;
  }

  async listProducts({ page, size, name, category, code }) {
    const filtered = this.products.filter((item) => {
      if (item.estado !== true) {
        return false;
      }

      if (name && !String(item.nombre).toLowerCase().includes(String(name).toLowerCase())) {
        return false;
      }

      if (typeof category === 'number' && item.id_categoria !== category) {
        return false;
      }

      if (code && !String(item.codigo).toLowerCase().includes(String(code).toLowerCase())) {
        return false;
      }

      return true;
    });

    const offset = (page - 1) * size;

    return {
      total: filtered.length,
      page,
      size,
      items: filtered.slice(offset, offset + size).map((item) => ({ ...item })),
    };
  }

  async updateProductPartial(idProducto, patch = {}) {
    const index = this.products.findIndex((item) => item.id_producto === idProducto);
    if (index < 0) {
      return null;
    }

    this.products[index] = { ...this.products[index], ...patch };
    return { ...this.products[index] };
  }

  async softDeleteProduct(idProducto) {
    return this.updateProductPartial(idProducto, { estado: false });
  }

  async getRawById(idProducto) {
    return this.products.find((item) => item.id_producto === idProducto) || null;
  }
}

module.exports = {
  PgProductRepository,
  InMemoryProductRepository,
};
