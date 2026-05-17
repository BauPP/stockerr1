const { validate, generate } = require('../models/barcode.model');

const MAX_COLLISION_RETRIES = 10;

function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

class BarcodeService {
  constructor({ repository }) {
    this.repository = repository;
  }

  /**
   * Look up a product by its barcode.
   * @param {string} code - 13-digit EAN-13 code
   * @returns {object} product data
   * @throws {Error} 400 if invalid format, 404 if not found
   */
  async lookupByCode(code) {
    // Validate format only (13 numeric digits), not checksum — existing data may have invalid checksums
    if (!code || typeof code !== 'string' || !/^\d{13}$/.test(code)) {
      throw createHttpError(400, 'INVALID_BARCODE_FORMAT', 'formato EAN-13 inválido');
    }

    const product = await this.repository.getProductByBarcode(code);
    if (!product) {
      throw createHttpError(404, 'BARCODE_NOT_FOUND', 'Código de barras no encontrado');
    }

    return {
      id_producto: product.id_producto,
      id_categoria: product.id_categoria,
      codigo_barras: product.codigo_barras_unico || product.codigo_barras,
      nombre: product.nombre,
      precio_compra: Number(product.precio_compra),
      precio_venta: Number(product.precio_venta),
      stock_actual: Number(product.stock_actual || 0),
      stock_minimo:
        product.stock_minimo === null || typeof product.stock_minimo === 'undefined'
          ? null
          : Number(product.stock_minimo),
      stock_maximo:
        product.stock_maximo === null || typeof product.stock_maximo === 'undefined'
          ? null
          : Number(product.stock_maximo),
      fecha_vencimiento: product.fecha_vencimiento || null,
      ubicacion: product.ubicacion || null,
      descripcion: product.descripcion || null,
      estado: product.estado,
      fecha_creacion: product.fecha_creacion || null,
    };
  }

  /**
   * Validate a barcode format and checksum.
   * @param {string} code
   * @returns {object} { valid, checksum?, message? }
   */
  validateCode(code) {
    return validate(code);
  }

  /**
   * Generate a unique valid EAN-13 barcode with collision retry.
   * @param {object} options
   * @param {string} [options.prefix] - optional prefix
   * @returns {Promise<{ code: string }>}
   * @throws {Error} if unable to generate unique code after MAX_COLLISION_RETRIES attempts
   */
  async generateCode(options = {}) {
    for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
      const code = generate(options);
      const existing = await this.repository.getProductByBarcode(code);
      if (!existing) {
        return { code };
      }
    }

    throw createHttpError(
      409,
      'BARCODE_GENERATION_FAILED',
      'No se pudo generar un código único después de varios intentos'
    );
  }
}

module.exports = { BarcodeService };
