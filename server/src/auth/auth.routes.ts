import { Router } from "express";

import { toPublicUser } from "../users/user.routes.js";
import { InvalidCredentialsError, UserInputError, type UserService } from "../users/user.service.js";
import type { AuthSessionService } from "./auth-session.service.js";
import { getBearerToken } from "./auth.middleware.js";

// POST /host/login: cada host (y la admin) entra con SU cuenta de `users`.
// POST /auth/logout y GET /auth/me sirven para cualquier rol.
export function createAuthRouter(userService: UserService, sessions: AuthSessionService): Router {
  const router = Router();

  router.post("/host/login", async (req, res, next) => {
    try {
      const body = typeof req.body === "object" && req.body !== null ? req.body as Record<string, unknown> : {};
      const user = await userService.login(body.nickname, body.password);

      if (user.role !== "HOST" && user.role !== "ADMIN") {
        res.status(403).json({ code: "NOT_A_HOST", message: "This account does not have host access" });
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
        res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Invalid nickname or password" });
        return;
      }
      next(error);
    }
  });

  router.post("/auth/logout", async (req, res, next) => {
    try {
      const token = getBearerToken(req);
      if (token) {
        await sessions.revoke(token);
      }
      res.status(204).send();
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get("/auth/me", async (req, res, next) => {
    try {
      const authUser = await sessions.resolve(getBearerToken(req));
      const user = authUser ? await userService.getById(authUser.id) : null;

      if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      res.json(toPublicUser(user));
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
}
