import { Router, type Request } from "express";

import { ClassInputError, type ClassService } from "./class.service.js";

export function createClassRouter(classService: ClassService): Router {
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
      if (error instanceof ClassInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}

function getPathParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}
