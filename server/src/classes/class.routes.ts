import { Router, type NextFunction, type Request, type Response } from "express";

import type { AuthGuards } from "../auth/auth.middleware.js";
import { ClassInUseError } from "./class.repository.js";
import {
  ClassGroupNotFoundError,
  ClassInputError,
  ClassModuleNotFoundError,
  ClassNotFoundError,
  type ClassService,
} from "./class.service.js";

// Leer clases es público (lo usan los selectores); crearlas, editarlas y
// borrarlas es para hosts y admin.
export function createClassRouter(guards: AuthGuards, classService: ClassService): Router {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      res.json(await classService.listClasses());
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const classItem = await classService.getClass(getPathParam(req, "id"));
      if (!classItem) {
        res.status(404).json({ message: "Class not found" });
        return;
      }
      res.json(classItem);
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  // Body: { moduleId, name, description?, startTime?, endTime?, sessions: [{ groupId, classDate }] }
  // Crea una clase por cada grupo/fecha, todas o ninguna.
  router.post("/", guards.requireHost, async (req, res, next) => {
    try {
      const body = asRecord(req.body);
      const created = await classService.createClasses({
        moduleId: body.moduleId,
        name: body.name,
        description: body.description,
        startTime: body.startTime,
        endTime: body.endTime,
        sessions: body.sessions,
      });
      res.status(201).json(created);
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.put("/:id", guards.requireHost, async (req, res, next) => {
    try {
      const body = asRecord(req.body);
      const updated = await classService.updateClass(getPathParam(req, "id"), {
        moduleId: body.moduleId,
        groupId: body.groupId,
        name: body.name,
        description: body.description,
        classDate: body.classDate,
        startTime: body.startTime,
        endTime: body.endTime,
      });
      res.json(updated);
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.delete("/:id", guards.requireHost, async (req, res, next) => {
    try {
      await classService.deleteClass(getPathParam(req, "id"));
      res.status(204).send();
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  return router;
}

export function createModuleRouter(guards: AuthGuards, classService: ClassService): Router {
  const router = Router();

  router.get("/", guards.requireHost, async (_req, res, next) => {
    try {
      res.json(await classService.listModules());
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
}

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof ClassInputError) {
    res.status(400).json({ message: error.message });
    return;
  }
  if (error instanceof ClassNotFoundError || error instanceof ClassGroupNotFoundError || error instanceof ClassModuleNotFoundError) {
    res.status(404).json({ message: error.message });
    return;
  }
  if (error instanceof ClassInUseError) {
    res.status(409).json({ message: error.message });
    return;
  }
  next(error);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function getPathParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}
