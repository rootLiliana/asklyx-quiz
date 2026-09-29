import { createHash, randomBytes } from "node:crypto";

import type { Mailer } from "../mailer.js";
import { hashPassword } from "./password.js";
import type { PasswordResetRepository } from "./password-reset.repository.js";
import type { UserRepository } from "./user.repository.js";

export class PasswordResetInputError extends Error {}
export class PasswordResetInvalidTokenError extends Error {}

export const RESET_TOKEN_TTL_MINUTES = 60;
const MIN_PASSWORD_LENGTH = 8;

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class PasswordResetService {
  constructor(
    private readonly users: UserRepository,
    private readonly resets: PasswordResetRepository,
    private readonly mailer: Mailer,
    private readonly appUrl: string,
    private readonly onPasswordChanged: (userId: string) => void = () => {},
  ) {}

  // Nunca revela si el correo existe: quien llama siempre responde lo mismo.
  // Devuelve una promesa del envío para poder esperarla en pruebas, pero la
  // ruta no la espera (así el tiempo de respuesta tampoco delata el correo).
  async requestReset(email: unknown): Promise<void> {
    if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      throw new PasswordResetInputError("email must be valid");
    }

    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user) {
      return;
    }

    const token = randomBytes(32).toString("base64url");
    await this.resets.create(user.id, hashResetToken(token), RESET_TOKEN_TTL_MINUTES);

    const link = `${this.appUrl.replace(/\/+$/, "")}/reset-password?token=${token}`;

    await this.mailer.send({
      to: user.email,
      subject: "Recupera tu contraseña de Lilihoot",
      text:
        `Hola ${user.name},\n\n` +
        `Recibimos una solicitud para restablecer la contraseña de tu cuenta (${user.nickname}).\n` +
        `Abre este enlace para elegir una nueva (vence en ${RESET_TOKEN_TTL_MINUTES} minutos):\n\n${link}\n\n` +
        "Si no fuiste tú, ignora este correo: tu contraseña no cambiará.",
      html:
        `<p>Hola ${escapeHtml(user.name)},</p>` +
        `<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta (<strong>${escapeHtml(user.nickname)}</strong>).</p>` +
        `<p><a href="${link}">Elegir una nueva contraseña</a></p>` +
        `<p>El enlace vence en ${RESET_TOKEN_TTL_MINUTES} minutos. Si no fuiste tú, ignora este correo: tu contraseña no cambiará.</p>`,
    });
  }

  async resetPassword(token: unknown, password: unknown): Promise<void> {
    if (typeof token !== "string" || !token.trim()) {
      throw new PasswordResetInputError("token is required");
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      throw new PasswordResetInputError(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const passwordHash = await hashPassword(password);
    const userId = await this.resets.consumeAndSetPassword(hashResetToken(token.trim()), passwordHash);

    if (!userId) {
      throw new PasswordResetInvalidTokenError("The reset link is invalid or has expired");
    }

    this.onPasswordChanged(userId);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
