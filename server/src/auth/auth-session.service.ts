import { createHash, randomBytes } from "node:crypto";

import type { AuthSessionRepository } from "./auth-session.repository.js";
import type { AuthUser } from "./auth.types.js";

export const SESSION_TTL_DAYS = 30;
// El Host consulta el juego cada 2 s; este caché evita ir a la BD en cada
// petición. Un cambio de rol hecho por la admin tarda como máximo esto en
// aplicar (cerrar sesión o restablecer contraseña aplica de inmediato).
const CACHE_TTL_MS = 60_000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

interface CachedSession {
  user: AuthUser;
  cachedAt: number;
}

export class AuthSessionService {
  private readonly cache = new Map<string, CachedSession>();

  constructor(
    private readonly sessions: AuthSessionRepository,
    private readonly now: () => number = Date.now,
  ) {}

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.sessions.create(hashToken(token), userId, SESSION_TTL_DAYS);
    return token;
  }

  async resolve(token: string): Promise<AuthUser | null> {
    if (!token) {
      return null;
    }

    const tokenHash = hashToken(token);
    const cached = this.cache.get(tokenHash);
    if (cached && this.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.user;
    }

    const user = await this.sessions.findUserByTokenHash(tokenHash);
    if (user) {
      this.cache.set(tokenHash, { user, cachedAt: this.now() });
    } else {
      this.cache.delete(tokenHash);
    }

    return user;
  }

  async revoke(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    this.cache.delete(tokenHash);
    await this.sessions.deleteByTokenHash(tokenHash);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const [tokenHash, cached] of this.cache) {
      if (cached.user.id === userId) {
        this.cache.delete(tokenHash);
      }
    }
    await this.sessions.deleteByUserId(userId);
  }

  // Tras cambiar el rol de alguien, que el nuevo rol aplique de inmediato.
  forgetCachedUser(userId: string): void {
    for (const [tokenHash, cached] of this.cache) {
      if (cached.user.id === userId) {
        this.cache.delete(tokenHash);
      }
    }
  }
}
