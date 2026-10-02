import { createHash, randomBytes, randomInt } from "node:crypto";

import type { Mailer } from "../mailer.js";
import { hashPassword, verifyPassword } from "./password.js";
import type { PasswordResetRepository } from "./password-reset.repository.js";
import type { UserRepository } from "./user.repository.js";
import type { UserRole } from "./user.types.js";

export class PasswordResetInputError extends Error {}
export class PasswordResetInvalidTokenError extends Error {}
// Correo y nickname no corresponden a una cuenta de alumna. Mismo error para
// todos los casos, para no revelar cuál de los dos datos falló.
export class PasswordResetIdentityMismatchError extends Error {}
export class PasswordResetTooManyAttemptsError extends Error {}
export class PasswordResetUserNotFoundError extends Error {}
export class PasswordResetForbiddenError extends Error {}
export class PasswordChangeWrongPasswordError extends Error {}

// Sin caracteres que se confunden al dictarlos (0/O, 1/l/I).
const TEMP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword(): string {
  const random = Array.from({ length: 6 }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join("");
  return `lili-${random}`;
}

export const RESET_TOKEN_TTL_MINUTES = 60;
const MIN_PASSWORD_LENGTH = 8;
export const MAX_DIRECT_RESET_FAILURES = 5;
const DIRECT_RESET_WINDOW_MS = 15 * 60_000;

interface FailureWindow {
  count: number;
  startedAt: number;
}

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
    private readonly now: () => number = Date.now,
  ) {}

  // Una host o la admin restablece la contraseña de una cuenta y recibe una
  // temporal para dársela a la persona. Las hosts solo pueden hacerlo con
  // cuentas de alumno; la admin también con hosts. Nunca con cuentas ADMIN.
  async adminReset(userId: string, actorRole: UserRole = "ADMIN"): Promise<{ temporaryPassword: string }> {
    if (!/^\d+$/.test(userId)) {
      throw new PasswordResetInputError("id must be a positive integer");
    }

    const user = await this.users.findById(userId);
    if (!user) {
      throw new PasswordResetUserNotFoundError("User not found");
    }
    if (user.role === "ADMIN") {
      throw new PasswordResetForbiddenError("ADMIN passwords cannot be reset from the app");
    }
    if (actorRole !== "ADMIN" && user.role !== "STUDENT") {
      throw new PasswordResetForbiddenError("Hosts can only reset student passwords");
    }

    const temporaryPassword = generateTemporaryPassword();
    await this.resets.setPasswordHash(user.id, await hashPassword(temporaryPassword), true);
    this.onPasswordChanged(user.id);

    return { temporaryPassword };
  }

  // La persona (con su sesión) cambia su propia contraseña. Es lo que pide la
  // app después de entrar con una contraseña temporal; quita la marca.
  async changeOwnPassword(userId: string, currentPassword: unknown, newPassword: unknown): Promise<void> {
    if (typeof currentPassword !== "string" || !currentPassword) {
      throw new PasswordResetInputError("currentPassword is required");
    }
    if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new PasswordResetInputError(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    if (newPassword === currentPassword) {
      throw new PasswordResetInputError("the new password must be different from the current one");
    }

    const user = await this.users.findById(userId);
    const withHash = user?.nickname ? await this.users.findAuthByNickname(user.nickname) : null;
    if (!user || !withHash?.passwordHash || withHash.id !== user.id) {
      throw new PasswordResetUserNotFoundError("User not found");
    }
    if (!(await verifyPassword(currentPassword, withHash.passwordHash))) {
      throw new PasswordChangeWrongPasswordError("Current password is incorrect");
    }

    await this.resets.setPasswordHash(user.id, await hashPassword(newPassword), false);
  }

  // Intentos fallidos de resetWithIdentity por correo (en memoria).
  private readonly directResetFailures = new Map<string, FailureWindow>();

  // Recuperación sin enlace: la alumna escribe su correo y su nickname y, si
  // ambos corresponden a la MISMA cuenta de alumna, elige una contraseña
  // nueva. Nunca aplica a cuentas HOST/ADMIN (esas solo por enlace), para que
  // conocer el correo y nickname de una host no baste para quedarse con su
  // cuenta. Tras varios intentos fallidos, el correo se bloquea un rato.
  async resetWithIdentity(email: unknown, nickname: unknown, password: unknown): Promise<void> {
    if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      throw new PasswordResetInputError("email must be valid");
    }
    if (typeof nickname !== "string" || !nickname.trim()) {
      throw new PasswordResetInputError("nickname is required");
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      throw new PasswordResetInputError(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    const normalizedEmail = email.trim().toLowerCase();
    this.assertNotLocked(normalizedEmail);

    const user = await this.users.findByEmail(normalizedEmail);
    const matches =
      user !== null &&
      user.role === "STUDENT" &&
      (user.nickname ?? "").toLowerCase() === nickname.trim().toLowerCase();

    if (!user || !matches) {
      this.recordFailure(normalizedEmail);
      throw new PasswordResetIdentityMismatchError("Email and nickname do not match a student account");
    }

    await this.resets.setPasswordHash(user.id, await hashPassword(password), false);
    this.directResetFailures.delete(normalizedEmail);
    this.onPasswordChanged(user.id);
  }

  private assertNotLocked(email: string): void {
    const failures = this.directResetFailures.get(email);
    if (!failures) return;

    if (this.now() - failures.startedAt >= DIRECT_RESET_WINDOW_MS) {
      this.directResetFailures.delete(email);
      return;
    }
    if (failures.count >= MAX_DIRECT_RESET_FAILURES) {
      throw new PasswordResetTooManyAttemptsError("Too many attempts, try again later");
    }
  }

  private recordFailure(email: string): void {
    const current = this.directResetFailures.get(email);
    this.directResetFailures.set(email, current
      ? { ...current, count: current.count + 1 }
      : { count: 1, startedAt: this.now() });
  }

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
