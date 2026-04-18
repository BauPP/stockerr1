const { createHttpError, toBooleanEstado } = require('../models/product.model');

function isCategoryActive(category) {
  if (!category) {
    return false;
  }

  try {
    return toBooleanEstado(category.estado);
  } catch (_error) {
    return false;
  }
}

function buildPriceWarning(product) {
  if (!product) {
    return null;
  }

  if (Number(product.precio_venta) < Number(product.precio_compra)) {
    return {
      code: 'SALE_PRICE_BELOW_PURCHASE_PRICE',
      message: 'El precio de venta es menor que el precio de compra',
    };
  }

  return null;
}

class ProductService {
  constructor({ repository }) {
    this.repository = repository;
  }

  async validateCategory(idCategoria) {
    const category = await this.repository.getCategoryById(idCategoria);

    if (!category) {
      throw createHttpError(404, 'CATEGORY_NOT_FOUND', 'Categoría no encontrada');
    }

    if (!isCategoryActive(category)) {
      throw createHttpError(409, 'CATEGORY_INACTIVE', 'La categoría seleccionada está inactiva');
    }
  }

  async createProduct(payload) {
    const existing = await this.repository.getProductByBarcode(payload.codigo_barras);
    if (existing) {
      throw createHttpError(409, 'PRODUCT_BARCODE_ALREADY_EXISTS', 'El código de barras ya está registrado');
    }

    await this.validateCategory(payload.id_categoria);

    const created = await this.repository.createProduct(payload);

    return {
      data: created,
      warning: buildPriceWarning(created),
    };
  }

  async getProductById(idProducto) {
    const product = await this.repository.getProductById(idProducto);
    if (!product) {
      throw createHttpError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado');
    }

    return {
      data: product,
      warning: buildPriceWarning(product),
    };
  }

  async listProducts(query) {
    const result = await this.repository.listProducts(query);

    return {
      total: result.total,
      page: result.page,
      size: result.size,
      totalPages: Math.ceil(result.total / result.size) || 1,
      items: result.items,
    };
  }

  async updateProduct(idProducto, patch) {
    const current = await this.repository.getProductById(idProducto);
    if (!current) {
      throw createHttpError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado');
    }

    if (typeof patch.id_categoria === 'number') {
      await this.validateCategory(patch.id_categoria);
    }

    const updated = await this.repository.updateProductPartial(idProducto, patch);

    return {
      data: updated,
      warning: buildPriceWarning(updated),
    };
  }

  async deleteProduct(idProducto) {
    const current = await this.repository.getProductById(idProducto);
    if (!current) {
      throw createHttpError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado');
    }

    const deleted = await this.repository.softDeleteProduct(idProducto);

    return {
      data: deleted,
      warning: buildPriceWarning(deleted),
    };
  }
}

module.exports = { ProductService };
