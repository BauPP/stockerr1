function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function toBooleanEstado(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['activo', 'true', '1'].includes(normalized)) {
      return true;
    }
    if (['inactivo', 'false', '0'].includes(normalized)) {
      return false;
    }
  }

  throw createHttpError(400, 'VALIDATION_ERROR', 'estado debe ser activo/inactivo o booleano');
}

function normalizeTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : String(value || '').trim();
}

function normalizeRequiredString(value, fieldName) {
  const normalized = normalizeTrimmedString(value);
  if (!normalized) {
    throw createHttpError(400, 'VALIDATION_ERROR', `${fieldName} es obligatorio`);
  }
  return normalized;
}

function normalizePositiveInteger(value, fieldName) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw createHttpError(400, 'VALIDATION_ERROR', `${fieldName} debe ser un entero positivo`);
  }
  return normalized;
}

function normalizePageNumber(value, fallback) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function normalizePrice(value, fieldName) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw createHttpError(400, 'VALIDATION_ERROR', `${fieldName} debe ser un número mayor o igual a 0`);
  }
  return normalized;
}

function normalizeBarcode(value) {
  const barcode = normalizeRequiredString(value, 'codigo_barras');
  if (!/^\d{13}$/.test(barcode)) {
    throw createHttpError(400, 'VALIDATION_ERROR', 'codigo_barras debe cumplir formato EAN-13');
  }
  return barcode;
}

function readAlias(source, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(source, alias)) {
      return source[alias];
    }
  }

  return undefined;
}

function validateCreateProductPayload(body) {
  if (!body || typeof body !== 'object') {
    throw createHttpError(400, 'VALIDATION_ERROR', 'El cuerpo de la solicitud es obligatorio');
  }

  const nombre = normalizeRequiredString(readAlias(body, ['nombre', 'name']), 'nombre');
  const codigo = normalizeRequiredString(readAlias(body, ['codigo', 'code']), 'codigo');
  const codigo_barras = normalizeBarcode(readAlias(body, ['codigo_barras', 'barcode']));
  const id_categoria = normalizePositiveInteger(
    readAlias(body, ['id_categoria', 'categoryId', 'category']),
    'id_categoria'
  );
  const precio_compra = normalizePrice(
    readAlias(body, ['precio_compra', 'purchase_price', 'purchasePrice']),
    'precio_compra'
  );
  const precio_venta = normalizePrice(
    readAlias(body, ['precio_venta', 'sale_price', 'salePrice']),
    'precio_venta'
  );
  const estado =
    typeof readAlias(body, ['estado']) === 'undefined'
      ? true
      : toBooleanEstado(readAlias(body, ['estado']));

  return {
    nombre,
    codigo,
    codigo_barras,
    id_categoria,
    precio_compra,
    precio_venta,
    estado,
  };
}

function validateUpdateProductPayload(body) {
  if (!body || typeof body !== 'object') {
    throw createHttpError(400, 'VALIDATION_ERROR', 'El cuerpo de la solicitud es obligatorio');
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'codigo_barras') ||
    Object.prototype.hasOwnProperty.call(body, 'barcode')
  ) {
    throw createHttpError(
      409,
      'PRODUCT_BARCODE_IMMUTABLE',
      'codigo_barras no puede modificarse una vez creado el producto'
    );
  }

  const patch = {};

  if (Object.prototype.hasOwnProperty.call(body, 'nombre') || Object.prototype.hasOwnProperty.call(body, 'name')) {
    patch.nombre = normalizeRequiredString(readAlias(body, ['nombre', 'name']), 'nombre');
  }

  if (Object.prototype.hasOwnProperty.call(body, 'codigo') || Object.prototype.hasOwnProperty.call(body, 'code')) {
    patch.codigo = normalizeRequiredString(readAlias(body, ['codigo', 'code']), 'codigo');
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'id_categoria') ||
    Object.prototype.hasOwnProperty.call(body, 'categoryId') ||
    Object.prototype.hasOwnProperty.call(body, 'category')
  ) {
    patch.id_categoria = normalizePositiveInteger(
      readAlias(body, ['id_categoria', 'categoryId', 'category']),
      'id_categoria'
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'precio_compra') ||
    Object.prototype.hasOwnProperty.call(body, 'purchase_price') ||
    Object.prototype.hasOwnProperty.call(body, 'purchasePrice')
  ) {
    patch.precio_compra = normalizePrice(
      readAlias(body, ['precio_compra', 'purchase_price', 'purchasePrice']),
      'precio_compra'
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(body, 'precio_venta') ||
    Object.prototype.hasOwnProperty.call(body, 'sale_price') ||
    Object.prototype.hasOwnProperty.call(body, 'salePrice')
  ) {
    patch.precio_venta = normalizePrice(
      readAlias(body, ['precio_venta', 'sale_price', 'salePrice']),
      'precio_venta'
    );
  }

  if (Object.prototype.hasOwnProperty.call(body, 'estado')) {
    patch.estado = toBooleanEstado(body.estado);
  }

  if (Object.keys(patch).length === 0) {
    throw createHttpError(400, 'VALIDATION_ERROR', 'Debe enviar al menos un campo para actualizar');
  }

  return patch;
}

function parseProductId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(400, 'VALIDATION_ERROR', 'id de producto inválido');
  }
  return id;
}

function parseListQuery(query = {}) {
  const page = normalizePageNumber(query.page, 1);
  const size = Math.min(100, normalizePageNumber(query.size, 10));
  const name = normalizeTrimmedString(readAlias(query, ['name', 'nombre']));
  const code = normalizeTrimmedString(readAlias(query, ['code', 'codigo']));
  const categoryRaw = readAlias(query, ['category', 'id_categoria', 'categoryId']);

  return {
    page,
    size,
    name: name || undefined,
    code: code || undefined,
    category: typeof categoryRaw === 'undefined' || categoryRaw === '' ? undefined : normalizePositiveInteger(categoryRaw, 'category'),
  };
}

module.exports = {
  createHttpError,
  toBooleanEstado,
  validateCreateProductPayload,
  validateUpdateProductPayload,
  parseProductId,
  parseListQuery,
};
