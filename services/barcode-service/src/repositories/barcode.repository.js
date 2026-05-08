/**
 * Barcode Repository
 *
 * PgBarcodeRepository: queries the real `productos` table via pg pool.
 * InMemoryBarcodeRepository: in-memory store for tests.
 * Both implement: getProductByBarcode(code) → product object or null
 */

class PgBarcodeRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async getProductByBarcode(codigoBarras) {
    const query = `
      SELECT
        id_producto,
        id_categoria,
        codigo_barras_unico,
        nombre,
        precio_compra,
        precio_venta,
        stock_actual,
        stock_minimo,
        stock_maximo,
        fecha_vencimiento,
        estado,
        fecha_creacion,
        ubicacion,
        descripcion
      FROM productos
      WHERE codigo_barras_unico = $1
      LIMIT 1
    `;

    const { rows } = await this.pool.query(query, [codigoBarras]);
    return rows[0] || null;
  }
}

class InMemoryBarcodeRepository {
  constructor({ products = [] } = {}) {
    this.products = products.map((p) => ({ ...p }));
  }

  async getProductByBarcode(codigoBarras) {
    const product = this.products.find(
      (p) => (p.codigo_barras_unico || p.codigo_barras) === codigoBarras
    );
    return product ? { ...product } : null;
  }
}

module.exports = {
  PgBarcodeRepository,
  InMemoryBarcodeRepository,
};
