import type { UserRepository } from "./user.repository.js";

export class PlayerIdentityNotFoundError extends Error {}
export class PlayerIdentityNotAStudentError extends Error {}

export interface StudentPlayerIdentity {
  userId: string;
  nickname: string;
}

// Resuelve `player.name` (el string que hoy ya viaja tal cual como `name` en
// POST /games/:code/join y que Game Manager guarda en Player.name) hacia la
// identidad real de la alumna, reutilizando el lookup por nickname que ya
// existe en UserRepository. No crea ninguna tabla ni toca Game Manager.
//
// El único input es el nickname/player.name: esta clase nunca acepta ni lee
// un userId directamente, así que no hay forma de "suplantar" a otra alumna
// pasando un id arbitrario. Cuando se dispone de un token de sesión (la propia
// alumna autenticada), la fuente de verdad sigue siendo
// requireStudent/getAuthUser (auth/auth.middleware.ts), no
// este resolutor. Este servicio es para el caso en el que solo se conoce el
// nickname/player.name (por ejemplo, del lado de la HOST).
export class PlayerIdentityService {
  constructor(private readonly users: UserRepository) {}

  async resolveStudentByNickname(nickname: string): Promise<StudentPlayerIdentity> {
    const trimmedNickname = typeof nickname === "string" ? nickname.trim() : "";

    if (!trimmedNickname) {
      throw new PlayerIdentityNotFoundError("nickname is required");
    }

    const user = await this.users.findByNickname(trimmedNickname);

    if (!user) {
      throw new PlayerIdentityNotFoundError("No user found for this nickname");
    }

    if (user.role !== "STUDENT") {
      throw new PlayerIdentityNotAStudentError("This nickname does not belong to a STUDENT account");
    }

    return { userId: user.id, nickname: user.nickname };
  }
}
