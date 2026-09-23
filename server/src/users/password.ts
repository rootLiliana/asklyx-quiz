import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_LENGTH = 64;

// Hash de referencia con formato válido pero sin contraseña real detrás.
// verifyPassword lo usa cuando el nickname no existe o no tiene password_hash,
// para que la operación tome un tiempo similar al de una verificación real y
// no delate por temporización si el nickname está o no registrado.
export const DUMMY_PASSWORD_HASH = `${"0".repeat(SALT_BYTES * 2)}:${"0".repeat(KEY_LENGTH * 2)}`;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);

  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, key] = storedHash.split(":");

  if (!salt || !key) {
    return false;
  }

  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = await scrypt(password, salt, keyBuffer.length);

  if (derivedKey.length !== keyBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, keyBuffer);
}
