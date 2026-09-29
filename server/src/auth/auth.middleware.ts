import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { UserRole } from "../users/user.types.js";
import type { AuthSessionService } from "./auth-session.service.js";
import type { AuthUser } from "./auth.types.js";

interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

export function getBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

// Solo disponible después de pasar por uno de los guards.
export function getAuthUser(req: Request): AuthUser | null {
  return (req as AuthenticatedRequest).authUser ?? null;
}

export interface AuthGuards {
  // Solo alumnas: HOST/ADMIN no pueden jugar.
  requireStudent: RequestHandler;
  // HOST o ADMIN: la admin puede todo lo que puede una host.
  requireHost: RequestHandler;
  requireAdmin: RequestHandler;
}

export function createAuthGuards(sessions: AuthSessionService): AuthGuards {
  function requireRole(allowedRoles: readonly UserRole[]): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = await sessions.resolve(getBearerToken(req));

        if (!user) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        if (!allowedRoles.includes(user.role)) {
          res.status(403).json({ message: "Forbidden" });
          return;
        }

        (req as AuthenticatedRequest).authUser = user;
        next();
      } catch (error: unknown) {
        next(error);
      }
    };
  }

  return {
    requireStudent: requireRole(["STUDENT"]),
    requireHost: requireRole(["HOST", "ADMIN"]),
    requireAdmin: requireRole(["ADMIN"]),
  };
}
