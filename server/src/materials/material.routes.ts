import { Router, type NextFunction, type Request, type Response } from "express";

import { getAuthUser, type AuthGuards } from "../auth/auth.middleware.js";
import { MaterialClassNotFoundError, MaterialInputError, MaterialNotFoundError, type MaterialService } from "./material.service.js";

// Material previo de cada clase.
//   Hosts y admin: crean, editan, publican y borran.
//   Alumnas: ven solo lo publicado de las clases de su grupo.
export function createMaterialRouter(guards: AuthGuards, materials: MaterialService): Router {
  const router = Router();

  router.get("/classes/:classId/materials", guards.requireHost, async (req, res, next) => {
    try {
      res.json(await materials.listForClass(getPathParam(req, "classId")));
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.get("/classes/:classId/materials/views", guards.requireHost, async (req, res, next) => {
    try {
      res.json(await materials.viewReport(getPathParam(req, "classId")));
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.post("/classes/:classId/materials", guards.requireHost, async (req, res, next) => {
    try {
      const material = await materials.create(getPathParam(req, "classId"), req.body, getAuthUser(req)?.id ?? "");
      res.status(201).json(material);
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.put("/materials/:id", guards.requireHost, async (req, res, next) => {
    try {
      res.json(await materials.update(getPathParam(req, "id"), req.body));
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.delete("/materials/:id", guards.requireHost, async (req, res, next) => {
    try {
      await materials.delete(getPathParam(req, "id"));
      res.status(204).send();
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.get("/me/classes", guards.requireStudent, async (req, res, next) => {
    try {
      res.json(await materials.listForStudent(getAuthUser(req)?.id ?? ""));
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.get("/me/materials/:id", guards.requireStudent, async (req, res, next) => {
    try {
      res.json(await materials.getForStudent(getPathParam(req, "id"), getAuthUser(req)?.id ?? ""));
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  return router;
}

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof MaterialInputError) {
    res.status(400).json({ message: error.message });
    return;
  }
  if (error instanceof MaterialNotFoundError || error instanceof MaterialClassNotFoundError) {
    res.status(404).json({ message: error.message });
    return;
  }
  next(error);
}

function getPathParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}
