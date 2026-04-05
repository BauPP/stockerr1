class InMemoryAuthRepository {
  constructor({ users = [] } = {}) {
    this.usersByUsername = new Map();
    this.usersById = new Map();
    this.revokedTokens = new Map();

    users.forEach((user) => {
      this.usersByUsername.set(user.nombre_usuario, { ...user });
      this.usersById.set(user.id_usuario, this.usersByUsername.get(user.nombre_usuario));
    });
  }

  async getUserByUsername(nombreUsuario) {
    return this.usersByUsername.get(nombreUsuario) || null;
  }

  async registerFailedAttempt(user, maxLoginAttempts, lockMinutes) {
    user.intentos_fallidos += 1;

    if (user.intentos_fallidos >= maxLoginAttempts) {
      user.bloqueo_hasta = Date.now() + lockMinutes * 60 * 1000;
      user.intentos_fallidos = 0;
      return { blocked: true, blockedUntil: user.bloqueo_hasta };
    }

    return { blocked: false };
  }

  async resetFailedAttempts(user) {
    user.intentos_fallidos = 0;
    user.bloqueo_hasta = null;
  }

  async revokeToken(token, expiresAtMs) {
    this.revokedTokens.set(token, expiresAtMs);
  }

  async isTokenRevoked(token) {
    const expiresAt = this.revokedTokens.get(token);
    if (!expiresAt) {
      return false;
    }

    if (Date.now() > expiresAt) {
      this.revokedTokens.delete(token);
      return false;
    }

    return true;
  }
}

module.exports = { InMemoryAuthRepository };
