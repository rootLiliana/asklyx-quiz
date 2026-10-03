import { Router, type NextFunction, type Request, type Response } from "express";

import { getAuthUser, type AuthGuards } from "../auth/auth.middleware.js";
import { QuizResultInputError, type QuizResultService } from "./quiz-result.service.js";

// Resultados (% de aciertos) de los juegos en vivo.
//   Hosts y admin: todas las sesiones, el detalle y el historial de cada alumna.
//   Alumnas: solo los suyos (GET /me/results).
export function createQuizResultRouter(guards: AuthGuards, results: QuizResultService): Router {
  const router = Router();

  router.get("/host/results/sessions", guards.requireHost, async (req, res, next) => {
    try {
      const groupId = typeof req.query.groupId === "string" && req.query.groupId ? req.query.groupId : undefined;
      res.json(await results.listSessions(groupId));
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.get("/host/results/sessions/:id", guards.requireHost, async (req, res, next) => {
    try {
      const detail = await results.getSessionDetail(getPathParam(req, "id"));
      if (!detail) {
        res.status(404).json({ message: "Session not found" });
        return;
      }
      res.json(detail);
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.get("/host/results/students/:id", guards.requireHost, async (req, res, next) => {
    try {
      res.json(await results.getStudentHistory(getPathParam(req, "id")));
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.get("/me/results", guards.requireStudent, async (req, res, next) => {
    try {
      res.json(await results.getStudentHistory(getAuthUser(req)?.id ?? ""));
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  return router;
}

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof QuizResultInputError) {
    res.status(400).json({ message: error.message });
    return;
  }
  next(error);
}

function getPathParam(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}
