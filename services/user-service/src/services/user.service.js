const bcrypt = require('bcryptjs');
const { createHttpError } = require('../models/user.model');

function isAdminRole(role) {
  if (!role) {
    return false;
  }

  const normalized = String(role).trim().toLowerCase();
  return normalized === 'admin' || normalized === 'administrador';
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { contrasena, ...safeUser } = user;
  return safeUser;
}

class UserService {
  constructor({ repository, bcryptSaltRounds = 10 }) {
    this.repository = repository;
    this.bcryptSaltRounds = bcryptSaltRounds;
  }

  async createUser(payload) {
    const existing = await this.repository.getUserByCorreo(payload.correo);
    if (existing) {
      throw createHttpError(409, 'USER_EMAIL_ALREADY_EXISTS', 'El correo ya está registrado');
    }

    const contrasena = await bcrypt.hash(payload.contrasena, this.bcryptSaltRounds);

    const created = await this.repository.createUser({
      id_rol: payload.id_rol,
      nombre: payload.nombre,
      correo: payload.correo,
      contrasena,
      estado: payload.estado,
    });

    return sanitizeUser(created);
  }

  async getUserById(idUsuario) {
    const user = await this.repository.getUserById(idUsuario);
    if (!user) {
      throw createHttpError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
    }

    return sanitizeUser(user);
  }

  async listUsers(query) {
    const result = await this.repository.listUsers(query);

    return {
      total: result.total,
      page: result.page,
      size: result.size,
      totalPages: Math.ceil(result.total / result.size) || 1,
      items: result.items.map(sanitizeUser),
    };
  }

  validateAdminSelfDisable(actorContext, targetUserId, nextEstado) {
    if (typeof nextEstado !== 'boolean') {
      return;
    }

    const isSelf = actorContext.userId && Number(actorContext.userId) === Number(targetUserId);
    if (isSelf && isAdminRole(actorContext.role) && nextEstado === false) {
      throw createHttpError(
        409,
        'ADMIN_SELF_DISABLE_FORBIDDEN',
        'Un administrador no puede deshabilitarse a sí mismo'
      );
    }
  }

  async updateUser(idUsuario, patch, actorContext = {}) {
    const current = await this.repository.getUserById(idUsuario);
    if (!current) {
      throw createHttpError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
    }

    if (patch.correo) {
      const duplicated = await this.repository.getUserByCorreoExcludingId(patch.correo, idUsuario);
      if (duplicated) {
        throw createHttpError(409, 'USER_EMAIL_ALREADY_EXISTS', 'El correo ya está registrado');
      }
    }

    this.validateAdminSelfDisable(actorContext, idUsuario, patch.estado);

    const patchToPersist = { ...patch };
    if (patch.contrasena) {
      patchToPersist.contrasena = await bcrypt.hash(patch.contrasena, this.bcryptSaltRounds);
    }

    const updated = await this.repository.updateUserPartial(idUsuario, patchToPersist);
    return sanitizeUser(updated);
  }

  async deleteUser(idUsuario, actorContext = {}) {
    const current = await this.repository.getUserById(idUsuario);
    if (!current) {
      throw createHttpError(404, 'USER_NOT_FOUND', 'Usuario no encontrado');
    }

    this.validateAdminSelfDisable(actorContext, idUsuario, false);

    const updated = await this.repository.softDeleteUser(idUsuario);
    return sanitizeUser(updated);
  }
}

module.exports = { UserService };
