const REASON_MATCHERS = {
  entrada: ['Compra / Reposicion', 'Compra / Reposición', 'Devolucion proveedor'],
  salida: {
    venta: ['Venta'],
    merma: ['Merma'],
    rotura: ['Rotura'],
    danado: ['Danado', 'Dañado'],
    vencido: ['Vencido', 'Caducidad'],
  },
  ajuste: {
    sobrante: ['Ajuste sobrante'],
    faltante: ['Ajuste faltante'],
  },
};

function cloneRecord(record) {
  return JSON.parse(JSON.stringify(record));
}

function normalizeReasonLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function deriveMovementTypeFromReason(record) {
  const tipoOperacion = normalizeReasonLabel(record.tipo_operacion || '');
  const motivo = normalizeReasonLabel(record.nombre_motivo || record.motivo || '');

  if (tipoOperacion === 'entrada') {
    return 'entrada';
  }

  if (tipoOperacion === 'ajuste' && motivo.includes('ajuste')) {
    return 'ajuste';
  }

  return 'salida';
}

class PgInventoryRepository {
  constructor({ pool }) {
    this.pool = pool;
  }

  async runInTransaction(handler) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await handler({ client });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  getTarget(trx) {
    return trx?.client || this.pool;
  }

  async getProductById(idProducto, { trx, lockForUpdate = false } = {}) {
    const target = this.getTarget(trx);
    const lockClause = lockForUpdate ? ' FOR UPDATE' : '';
    const query = `
      SELECT
        p.id_producto,
        p.id_categoria,
        p.codigo_barras_unico,
        p.nombre,
        p.precio_compra,
        p.precio_venta,
        p.stock_actual,
        p.stock_minimo,
        p.stock_maximo,
        p.fecha_vencimiento,
        p.estado,
        p.ubicacion,
        p.descripcion,
        c.nombre_categoria
      FROM productos p
      JOIN categorias c ON c.id_categoria = p.id_categoria
      WHERE p.id_producto = $1
      LIMIT 1${lockClause}
    `;

    const { rows } = await target.query(query, [idProducto]);
    return rows[0] || null;
  }

  async getProviderById(idProveedor, { trx } = {}) {
    const target = this.getTarget(trx);
    const query = `
      SELECT id_proveedor, razon_social, estado
      FROM proveedores
      WHERE id_proveedor = $1
      LIMIT 1
    `;

    const { rows } = await target.query(query, [idProveedor]);
    return rows[0] || null;
  }

  async findReasonByPayload(payload, { trx } = {}) {
    const target = this.getTarget(trx);
    let candidates = [];

    if (payload.tipo_movimiento === 'entrada') {
      candidates = REASON_MATCHERS.entrada;
    } else if (payload.tipo_movimiento === 'salida') {
      candidates = REASON_MATCHERS.salida[payload.motivo] || [];
    } else {
      candidates = REASON_MATCHERS.ajuste[payload.tipo_ajuste] || [];
    }

    const { rows } = await target.query(
      `
        SELECT id_motivo, nombre_motivo, tipo_operacion
        FROM motivos_movimiento
        ORDER BY id_motivo ASC
      `
    );

    const normalizedCandidates = candidates.map((item) => normalizeReasonLabel(item));
    return (
      rows.find((row) => normalizedCandidates.includes(normalizeReasonLabel(row.nombre_motivo))) ||
      null
    );
  }

  async createMovement(payload, { trx } = {}) {
    const target = this.getTarget(trx);
    const query = `
      INSERT INTO movimientos_inventario (
        id_producto,
        id_usuario,
        id_proveedor,
        id_motivo,
        cantidad,
        stock_anterior,
        stock_posterior,
        numero_factura,
        comentarios
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id_movimiento,
        id_producto,
        id_usuario,
        id_proveedor,
        id_motivo,
        cantidad,
        stock_anterior,
        stock_posterior,
        numero_factura,
        comentarios,
        fecha_hora_exacta
    `;

    const values = [
      payload.id_producto,
      payload.id_usuario,
      payload.id_proveedor || null,
      payload.id_motivo,
      payload.cantidad,
      payload.stock_anterior,
      payload.stock_posterior,
      payload.numero_factura || null,
      payload.comentarios || null,
    ];

    const { rows } = await target.query(query, values);
    return rows[0] || null;
  }

  async createAdjustmentAudit(payload, { trx } = {}) {
    const target = this.getTarget(trx);
    const query = `
      INSERT INTO ajustes_inventario (
        id_usuario,
        id_producto,
        cantidad,
        motivo,
        tipo_ajuste
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id_ajuste
    `;

    const values = [
      payload.id_usuario,
      payload.id_producto,
      payload.cantidad,
      payload.motivo,
      payload.tipo_ajuste.toUpperCase(),
    ];

    const { rows } = await target.query(query, values);
    return rows[0] || null;
  }

  async listMovements(filters = {}) {
    const params = [];
    const where = [];

    if (typeof filters.productId === 'number') {
      params.push(filters.productId);
      where.push(`m.id_producto = $${params.length}`);
    }

    if (filters.exactDate) {
      params.push(filters.exactDate);
      where.push(`DATE(m.fecha_hora_exacta) = $${params.length}`);
    } else {
      if (filters.dateFrom) {
        params.push(filters.dateFrom);
        where.push(`m.fecha_hora_exacta >= $${params.length}`);
      }

      if (filters.dateTo) {
        params.push(`${filters.dateTo}T23:59:59.999Z`);
        where.push(`m.fecha_hora_exacta <= $${params.length}`);
      }
    }

    if (filters.movementType === 'entrada') {
      where.push(`LOWER(mm.tipo_operacion::text) = 'entrada'`);
    }

    if (filters.movementType === 'salida') {
      where.push(
        `(LOWER(mm.tipo_operacion::text) = 'salida' OR (LOWER(mm.tipo_operacion::text) = 'ajuste' AND LOWER(mm.nombre_motivo) NOT LIKE '%ajuste%'))`
      );
    }

    if (filters.movementType === 'ajuste') {
      where.push(
        `(LOWER(mm.tipo_operacion::text) = 'ajuste' AND LOWER(mm.nombre_motivo) LIKE '%ajuste%')`
      );
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM movimientos_inventario m
      JOIN motivos_movimiento mm ON mm.id_motivo = m.id_motivo
      ${whereClause}
    `;

    const countResult = await this.pool.query(countQuery, params);
    const total = countResult.rows[0]?.total || 0;

    const offset = (filters.page - 1) * filters.size;
    const listParams = [...params, filters.size, offset];
    const listQuery = `
      SELECT
        m.id_movimiento,
        m.id_producto,
        m.id_usuario,
        m.id_proveedor,
        m.id_motivo,
        m.cantidad,
        m.stock_anterior,
        m.stock_posterior,
        m.numero_factura,
        m.comentarios,
        m.fecha_hora_exacta,
        p.nombre AS nombre_producto,
        u.nombre AS nombre_usuario,
        mm.nombre_motivo,
        mm.tipo_operacion
      FROM movimientos_inventario m
      JOIN productos p ON p.id_producto = m.id_producto
      JOIN usuarios u ON u.id_usuario = m.id_usuario
      JOIN motivos_movimiento mm ON mm.id_motivo = m.id_motivo
      ${whereClause}
      ORDER BY m.fecha_hora_exacta DESC, m.id_movimiento DESC
      LIMIT $${listParams.length - 1}
      OFFSET $${listParams.length}
    `;

    const { rows } = await this.pool.query(listQuery, listParams);

    return {
      total,
      page: filters.page,
      size: filters.size,
      items: rows.map((row) => ({
        ...row,
        movement_type: deriveMovementTypeFromReason(row),
      })),
    };
  }
}

class InMemoryInventoryRepository {
  constructor({ products = [], movements = [] } = {}) {
    this.products = products.map((product) => cloneRecord(product));
    this.movements = movements.map((movement) => cloneRecord(movement));
    this.nextMovementId =
      this.movements.length > 0
        ? Math.max(...this.movements.map((movement) => movement.id_movimiento || 0)) + 1
        : 1;
  }

  async runInTransaction(handler) {
    const snapshot = {
      products: this.products.map((product) => cloneRecord(product)),
      movements: this.movements.map((movement) => cloneRecord(movement)),
      nextMovementId: this.nextMovementId,
    };

    try {
      return await handler({});
    } catch (error) {
      this.products = snapshot.products;
      this.movements = snapshot.movements;
      this.nextMovementId = snapshot.nextMovementId;
      throw error;
    }
  }

  async getProductById(idProducto) {
    const product = this.products.find((item) => item.id_producto === idProducto);
    return product ? cloneRecord(product) : null;
  }

  async getProviderById(idProveedor) {
    return idProveedor ? { id_proveedor: idProveedor, razon_social: 'Proveedor Demo', estado: true } : null;
  }

  async findReasonByPayload(payload) {
    if (payload.tipo_movimiento === 'entrada') {
      return {
        id_motivo: 1,
        nombre_motivo: 'Compra / Reposicion',
        tipo_operacion: 'ENTRADA',
      };
    }

    if (payload.tipo_movimiento === 'salida') {
      return {
        id_motivo: 10,
        nombre_motivo: payload.motivo,
        tipo_operacion: 'SALIDA',
      };
    }

    return {
      id_motivo: payload.tipo_ajuste === 'sobrante' ? 18 : 19,
      nombre_motivo: `Ajuste ${payload.tipo_ajuste}`,
      tipo_operacion: 'AJUSTE',
    };
  }

  async createMovement(payload) {
    const record = {
      id_movimiento: this.nextMovementId,
      fecha_hora_exacta: payload.fecha_hora_exacta,
      movement_type: payload.movement_type || payload.tipo_movimiento,
      ...payload,
    };

    this.movements.push(record);
    this.nextMovementId += 1;

    const index = this.products.findIndex((item) => item.id_producto === payload.id_producto);
    if (index >= 0) {
      this.products[index] = {
        ...this.products[index],
        stock_actual: payload.stock_posterior,
      };
    }

    return cloneRecord(record);
  }

  async createAdjustmentAudit(_payload) {
    return { id_ajuste: 1 };
  }

  async listMovements(filters = {}) {
    const filtered = this.movements
      .filter((movement) => {
        if (
          typeof filters.productId === 'number' &&
          movement.id_producto !== filters.productId
        ) {
          return false;
        }

        const movementDate = new Date(movement.fecha_hora_exacta).toISOString().slice(0, 10);
        if (filters.exactDate && movementDate !== filters.exactDate) {
          return false;
        }
        if (filters.dateFrom && movementDate < filters.dateFrom) {
          return false;
        }
        if (filters.dateTo && movementDate > filters.dateTo) {
          return false;
        }
        if (filters.movementType && movement.movement_type !== filters.movementType) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        const byDate =
          new Date(right.fecha_hora_exacta).getTime() - new Date(left.fecha_hora_exacta).getTime();
        if (byDate !== 0) {
          return byDate;
        }

        return (right.id_movimiento || 0) - (left.id_movimiento || 0);
      })
      .map((movement) => {
        const product = this.products.find((item) => item.id_producto === movement.id_producto);
        return {
          ...cloneRecord(movement),
          nombre_producto: product?.nombre || movement.nombre_producto || null,
        };
      });

    const offset = (filters.page - 1) * filters.size;

    return {
      total: filtered.length,
      page: filters.page,
      size: filters.size,
      items: filtered.slice(offset, offset + filters.size),
    };
  }
}

module.exports = {
  PgInventoryRepository,
  InMemoryInventoryRepository,
};
