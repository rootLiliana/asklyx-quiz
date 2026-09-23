import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export interface StudentSession {
  userId: string;
}

// Independiente de hostSessions (index.ts): las sesiones de alumnas nunca deben
// otorgar ni cruzarse con permisos de HOST/ADMIN.
const studentSessions = new Map<string, StudentSession>();

export function createStudentSession(userId: string): string {
  const token = randomUUID();
  studentSessions.set(token, { userId });

  return token;
}

export function getStudentSession(token: string): StudentSession | null {
  return studentSessions.get(token) ?? null;
}

interface AuthenticatedStudentRequest extends Request {
  studentUserId?: string;
}

function getBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

// Igual que requireHostAuth/requireAdminAuth (index.ts): valida un token
// Bearer contra un Map en memoria. Nunca lee un userId del body: lo obtiene
// exclusivamente de la sesión ya autenticada.
export function requireStudentAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  const session = token ? getStudentSession(token) : null;

  if (!session) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  (req as AuthenticatedStudentRequest).studentUserId = session.userId;
  next();
}

export function getAuthenticatedStudentUserId(req: Request): string | null {
  return (req as AuthenticatedStudentRequest).studentUserId ?? null;
}
