import { Router, type Request } from "express";

import type { AuthGuards } from "../auth/auth.middleware.js";
import type { AuthSessionService } from "../auth/auth-session.service.js";
import { PasswordResetInputError, PasswordResetInvalidTokenError, type PasswordResetService } from "./password-reset.service.js";
import {
  DuplicateUserError,
  InvalidCredentialsError,
  UserInputError,
  UserRoleChangeForbiddenError,
  type UserService,
} from "./user.service.js";
import type { User } from "./user.types.js";

export function createUserRouter(
  guards: AuthGuards,
  userService: UserService,
  passwordResetService: PasswordResetService,
  sessions: AuthSessionService,
): Router {
  const router = Router();

  router.post("/register", async (req, res, next) => {
    try {
      const body = asRecord(req.body);
      const user = await userService.register({
        name: typeof body.name === "string" ? body.name : "",
        lastNamePaternal: typeof body.lastNamePaternal === "string" ? body.lastNamePaternal : "",
        lastNameMaternal: typeof body.lastNameMaternal === "string" ? body.lastNameMaternal : undefined,
        email: typeof body.email === "string" ? body.email : "",
        nickname: typeof body.nickname === "string" ? body.nickname : "",
        password: typeof body.password === "string" ? body.password : "",
      });

      res.status(201).json(toPublicUser(user));
    } catch (error: unknown) {
      if (error instanceof UserInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof DuplicateUserError) {
        res.status(409).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  // Login de alumnas. Las cuentas HOST/ADMIN no pueden jugar: entran desde
  // POST /host/login.
  router.post("/login", async (req, res, next) => {
    try {
      const body = asRecord(req.body);
      const user = await userService.login(body.nickname, body.password);

      if (user.role !== "STUDENT") {
        res.status(403).json({ code: "USE_HOST_LOGIN", message: "This account must sign in from the host panel" });
        return;
      }

      const token = await sessions.create(user.id);
      res.json({ token, user: toPublicUser(user) });
    } catch (error: unknown) {
      if (error instanceof UserInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof InvalidCredentialsError) {
        res.status(401).json({ message: "Invalid nickname or password" });
        return;
      }
      next(error);
    }
  });

  // Siempre responde 202 con el mismo mensaje exista o no el correo, y el
  // envío corre en segundo plano para que el tiempo de respuesta tampoco lo
  // delate.
  router.post("/password/forgot", (req, res) => {
    const email = asRecord(req.body).email;

    if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      res.status(400).json({ message: "email must be valid" });
      return;
    }

    passwordResetService.requestReset(email).catch((error: unknown) => {
      console.error("No se pudo procesar la solicitud de recuperación de contraseña", error);
    });

    res.status(202).json({ message: "If the email is registered, a reset link has been sent" });
  });

  router.post("/password/reset", async (req, res, next) => {
    try {
      const body = asRecord(req.body);
      await passwordResetService.resetPassword(body.token, body.password);
      res.json({ message: "Password updated" });
    } catch (error: unknown) {
      if (error instanceof PasswordResetInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof PasswordResetInvalidTokenError) {
        res.status(410).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.get("/", guards.requireAdmin, async (req, res, next) => {
    try {
      const role = req.query.role;
      const users = await userService.listUsers(typeof role === "string" ? role : undefined);
      res.json(users.map(toPublicUser));
    } catch (error: unknown) {
      if (error instanceof UserInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.get("/:id", guards.requireHost, async (req, res, next) => {
    try {
      const user = await userService.getById(getPathId(req));
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      res.json(toPublicUser(user));
    } catch (error: unknown) {
      if (error instanceof UserInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  router.patch("/:id/role", guards.requireAdmin, async (req, res, next) => {
    try {
      const user = await userService.changeRole(getPathId(req), asRecord(req.body).role);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      sessions.forgetCachedUser(user.id);
      res.json(toPublicUser(user));
    } catch (error: unknown) {
      if (error instanceof UserInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof UserRoleChangeForbiddenError) {
        res.status(403).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function getPathId(req: Request): string {
  const id = req.params.id;
  return typeof id === "string" ? id : "";
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    lastNamePaternal: user.lastNamePaternal,
    lastNameMaternal: user.lastNameMaternal,
    email: user.email,
    nickname: user.nickname,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
