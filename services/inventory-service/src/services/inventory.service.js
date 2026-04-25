const { ADMINISTRADOR, OPERADOR } = require('../../../../shared/constants/roles');
const { MOVEMENT_TYPES, createHttpError } = require('../models/inventory.model');

function isActiveProduct(product) {
  if (!product) {
    return false;
  }

  if (typeof product.estado === 'boolean') {
    return product.estado;
  }

  const normalized = String(product.estado || '').trim().toLowerCase();
  return normalized === 'activo' || normalized === 'true' || normalized === '1';
}

function isActiveProvider(provider) {
  if (!provider) {
    return false;
  }

  if (typeof provider.estado === 'boolean') {
    return provider.estado;
  }

  const normalized = String(provider.estado || '').trim().toLowerCase();
  return normalized === 'activo' || normalized === 'true' || normalized === '1';
}

function formatMovementResponse(movement, actorRoleOverride) {
  const timestamp = new Date(movement.fecha_hora_exacta || movement.fecha_movimiento);
  return {
    id_movimiento: movement.id_movimiento,
    tipo: movement.movement_type || movement.tipo_movimiento,
    fecha: timestamp.toISOString().slice(0, 10),
    hora: timestamp.toISOString().slice(11, 19),
    id_producto: movement.id_producto,
    nombre_producto: movement.nombre_producto,
    cantidad: Number(movement.cantidad),
    stock_anterior: Number(movement.stock_anterior),
    nuevo_stock: Number(movement.stock_posterior),
    usuario: {
      id_usuario: movement.id_usuario,
      nombre: movement.nombre_usuario || movement.usuario_nombre,
      rol: actorRoleOverride || movement.rol_usuario || null,
    },
    motivo: movement.nombre_motivo || movement.motivo || movement.motivo_ajuste || null,
    comentario: movement.comentarios || movement.comentario || null,
    tipo_ajuste: movement.tipo_ajuste || null,
    fecha_vencimiento: movement.fecha_vencimiento || null,
    id_proveedor: movement.id_proveedor || null,
    numero_factura: movement.numero_factura || null,
  };
}

class InventoryService {
  constructor({ repository, notifier = { notifyMovementRegistered: async () => {} } }) {
    this.repository = repository;
    this.notifier = notifier;
  }

  assertPermissions(tipoMovimiento, actor) {
    if (!actor?.id_usuario) {
      throw createHttpError(401, 'AUTH_TOKEN_INVALID', 'Token invalido');
    }

    const role = actor.rol;

    if (tipoMovimiento === MOVEMENT_TYPES.ADJUSTMENT && role !== ADMINISTRADOR) {
      throw createHttpError(
        403,
        'INVENTORY_ADJUSTMENT_FORBIDDEN',
        'No tiene permisos para registrar ajustes de inventario'
      );
    }

    if (![ADMINISTRADOR, OPERADOR].includes(role)) {
      throw createHttpError(
        403,
        'INVENTORY_MOVEMENT_FORBIDDEN',
        'No tiene permisos para registrar movimientos de inventario'
      );
    }
  }

  buildNextStock(payload, stockAnterior) {
    if (payload.tipo_movimiento === MOVEMENT_TYPES.ENTRY) {
      return stockAnterior + payload.cantidad;
    }

    if (payload.tipo_movimiento === MOVEMENT_TYPES.EXIT) {
      if (stockAnterior < payload.cantidad) {
        throw createHttpError(
          422,
          'INSUFFICIENT_STOCK',
          'Stock insuficiente para registrar la salida'
        );
      }

      return stockAnterior - payload.cantidad;
    }

    if (payload.tipo_ajuste === 'sobrante') {
      return stockAnterior + payload.cantidad;
    }

    if (stockAnterior < payload.cantidad) {
      throw createHttpError(
        422,
        'NEGATIVE_STOCK_NOT_ALLOWED',
        'El ajuste no puede dejar el stock en negativo'
      );
    }

    return stockAnterior - payload.cantidad;
  }

  async registerMovement(payload, { actor }) {
    this.assertPermissions(payload.tipo_movimiento, actor);

    const persisted = await this.repository.runInTransaction(async (trx) => {
      const product = await this.repository.getProductById(payload.id_producto, {
        trx,
        lockForUpdate: true,
      });

      if (!product || !isActiveProduct(product)) {
        throw createHttpError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado');
      }

      if (payload.id_proveedor) {
        const provider = await this.repository.getProviderById(payload.id_proveedor, { trx });
        if (!provider || !isActiveProvider(provider)) {
          throw createHttpError(404, 'SUPPLIER_NOT_FOUND', 'Proveedor no encontrado');
        }
      }

      const stockAnterior = Number(product.stock_actual || 0);
      const stockPosterior = this.buildNextStock(payload, stockAnterior);
      const reason = await this.repository.findReasonByPayload(payload, { trx });

      if (!reason) {
        throw createHttpError(
          500,
          'MOVEMENT_REASON_NOT_FOUND',
          'No fue posible determinar el motivo del movimiento'
        );
      }

      const movement = await this.repository.createMovement(
        {
          id_producto: payload.id_producto,
          id_usuario: actor.id_usuario,
          id_proveedor: payload.id_proveedor,
          id_motivo: reason.id_motivo,
          cantidad: payload.cantidad,
          stock_anterior: stockAnterior,
          stock_posterior: stockPosterior,
          numero_factura: payload.numero_factura,
          comentarios: payload.comentario || payload.motivo_ajuste || payload.motivo,
          movement_type: payload.tipo_movimiento,
          fecha_hora_exacta: new Date().toISOString(),
        },
        { trx }
      );

      if (payload.tipo_movimiento === MOVEMENT_TYPES.ADJUSTMENT) {
        await this.repository.createAdjustmentAudit(
          {
            id_usuario: actor.id_usuario,
            id_producto: payload.id_producto,
            cantidad: payload.cantidad,
            motivo: payload.motivo_ajuste,
            tipo_ajuste: payload.tipo_ajuste,
          },
          { trx }
        );
      }

      return {
        ...movement,
        nombre_producto: product.nombre,
        nombre_usuario: actor.nombre,
        rol_usuario: actor.rol,
        nombre_motivo:
          payload.tipo_movimiento === MOVEMENT_TYPES.ADJUSTMENT
            ? payload.motivo_ajuste
            : reason.nombre_motivo,
        movement_type: payload.tipo_movimiento,
        tipo_ajuste: payload.tipo_ajuste || null,
        fecha_vencimiento: payload.fecha_vencimiento || null,
      };
    });

    void this.notifier.notifyMovementRegistered(persisted).catch(() => {});

    return {
      data: formatMovementResponse(persisted, actor.rol),
    };
  }

  async listMovements(filters) {
    const result = await this.repository.listMovements(filters);

    return {
      total: result.total,
      page: result.page,
      size: result.size,
      totalPages: Math.ceil(result.total / result.size) || 1,
      items: result.items.map((movement) => formatMovementResponse(movement)),
    };
  }
}

module.exports = { InventoryService };
