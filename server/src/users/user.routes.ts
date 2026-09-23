import { Router, type NextFunction, type Request, type Response } from "express";

import { createStudentSession } from "./student-session.js";
import { MysqlUserRepository } from "./user.repository.js";
import { DuplicateUserError, InvalidCredentialsError, UserInputError, UserService } from "./user.service.js";
import type { User } from "./user.types.js";

type AdminGuard = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

const userService = new UserService(new MysqlUserRepository());

export function createUserRouter(requireAdmin: AdminGuard): Router {
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

  router.post("/login", async (req, res, next) => {
    try {
      const body = asRecord(req.body);
      const user = await userService.login(body.nickname, body.password);
      const token = createStudentSession(user.id);

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

  router.get("/", requireAdmin, async (req, res, next) => {
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

  router.get("/:id", async (req, res, next) => {
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

  router.patch("/:id/role", requireAdmin, async (req, res, next) => {
    try {
      const user = await userService.changeRole(getPathId(req), asRecord(req.body).role);
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

  return router;
}

export async function findConfiguredAdmin() {
  const nickname = process.env.ADMIN_NICKNAME?.trim();
  if (!nickname) {
    throw new Error("ADMIN_NICKNAME is not configured");
  }
  return userService.getByNickname(nickname);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function getPathId(req: Request): string {
  const id = req.params.id;
  return typeof id === "string" ? id : "";
}

function toPublicUser(user: User) {
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
