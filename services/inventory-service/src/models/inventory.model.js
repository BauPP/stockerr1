const MOVEMENT_TYPES = Object.freeze({
  ENTRY: 'entrada',
  EXIT: 'salida',
  ADJUSTMENT: 'ajuste',
});

const EXIT_REASONS = new Set(['venta', 'merma', 'rotura', 'danado', 'vencido']);
const ADJUSTMENT_TYPES = new Set(['sobrante', 'faltante']);

function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function readAlias(source, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(source, alias)) {
      return source[alias];
    }
  }

  return undefined;
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

function normalizeOptionalString(value) {
  const normalized = normalizeTrimmedString(value);
  return normalized || undefined;
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

function normalizeIsoDate(value, fieldName) {
  const normalized = normalizeRequiredString(value, fieldName);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw createHttpError(400, 'VALIDATION_ERROR', `${fieldName} debe tener formato YYYY-MM-DD`);
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, 'VALIDATION_ERROR', `${fieldName} no es una fecha valida`);
  }

  return normalized;
}

function normalizeOptionalDate(value, fieldName) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return undefined;
  }

  return normalizeIsoDate(value, fieldName);
}

function normalizeMovementType(value) {
  const normalized = normalizeRequiredString(value, 'tipo_movimiento').toLowerCase();
  if (!Object.values(MOVEMENT_TYPES).includes(normalized)) {
    throw createHttpError(
      400,
      'VALIDATION_ERROR',
      'tipo_movimiento debe ser entrada, salida o ajuste'
    );
  }

  return normalized;
}

function validateCreateMovementPayload(body) {
  if (!body || typeof body !== 'object') {
    throw createHttpError(400, 'VALIDATION_ERROR', 'El cuerpo de la solicitud es obligatorio');
  }

  const id_producto = normalizePositiveInteger(
    readAlias(body, ['id_producto', 'idProducto', 'productId']),
    'id_producto'
  );
  const tipo_movimiento = normalizeMovementType(
    readAlias(body, ['tipo_movimiento', 'tipoMovimiento', 'tipo'])
  );
  const cantidad = normalizePositiveInteger(body.cantidad, 'cantidad');
  const comentario = normalizeOptionalString(body.comentario);

  if (tipo_movimiento === MOVEMENT_TYPES.ENTRY) {
    return {
      id_producto,
      tipo_movimiento,
      cantidad,
      comentario,
      fecha_vencimiento: normalizeOptionalDate(body.fecha_vencimiento, 'fecha_vencimiento'),
      id_proveedor:
        typeof body.id_proveedor === 'undefined'
          ? undefined
          : normalizePositiveInteger(body.id_proveedor, 'id_proveedor'),
      numero_factura: normalizeOptionalString(body.numero_factura),
    };
  }

  if (tipo_movimiento === MOVEMENT_TYPES.EXIT) {
    const motivo = normalizeRequiredString(body.motivo, 'motivo').toLowerCase();
    if (!EXIT_REASONS.has(motivo)) {
      throw createHttpError(
        400,
        'VALIDATION_ERROR',
        'motivo debe ser Venta, Merma, Rotura, Danado o Vencido'
      );
    }

    return {
      id_producto,
      tipo_movimiento,
      cantidad,
      motivo,
      comentario,
    };
  }

  const tipo_ajuste = normalizeRequiredString(
    readAlias(body, ['tipo_ajuste', 'tipoAjuste']),
    'tipo_ajuste'
  ).toLowerCase();

  if (!ADJUSTMENT_TYPES.has(tipo_ajuste)) {
    throw createHttpError(400, 'VALIDATION_ERROR', 'tipo_ajuste debe ser sobrante o faltante');
  }

  return {
    id_producto,
    tipo_movimiento,
    cantidad,
    tipo_ajuste,
    motivo_ajuste: normalizeRequiredString(
      readAlias(body, ['motivo_ajuste', 'motivoAjuste']),
      'motivo_ajuste'
    ),
    comentario,
  };
}

function parseMovementFilters(query = {}) {
  const page = normalizePageNumber(query.page, 1);
  const size = Math.min(100, normalizePageNumber(query.size, 10));
  const productIdRaw = readAlias(query, ['producto', 'id_producto', 'productId']);
  const typeRaw = readAlias(query, ['tipo', 'tipo_movimiento', 'movementType']);
  const exactDate = normalizeOptionalDate(readAlias(query, ['fecha', 'date']), 'fecha');
  const dateFrom = normalizeOptionalDate(
    readAlias(query, ['fecha_desde', 'dateFrom']),
    'fecha_desde'
  );
  const dateTo = normalizeOptionalDate(
    readAlias(query, ['fecha_hasta', 'dateTo']),
    'fecha_hasta'
  );

  if (!exactDate && dateFrom && dateTo && dateFrom > dateTo) {
    throw createHttpError(
      400,
      'VALIDATION_ERROR',
      'fecha_desde no puede ser mayor a fecha_hasta'
    );
  }

  return {
    page,
    size,
    productId:
      typeof productIdRaw === 'undefined' || productIdRaw === ''
        ? undefined
        : normalizePositiveInteger(productIdRaw, 'producto'),
    movementType:
      typeof typeRaw === 'undefined' || typeRaw === ''
        ? undefined
        : normalizeMovementType(typeRaw),
    exactDate,
    dateFrom: exactDate ? undefined : dateFrom,
    dateTo: exactDate ? undefined : dateTo,
  };
}

module.exports = {
  MOVEMENT_TYPES,
  createHttpError,
  validateCreateMovementPayload,
  parseMovementFilters,
};
