import { Router, type NextFunction, type Request, type Response } from "express";

import { getAuthUser, type AuthGuards } from "../auth/auth.middleware.js";
import { PracticeAlreadyAnsweredError, PracticeInUseError } from "./practice.repository.js";
import { PracticeAttemptFinishedError, PracticeInputError, PracticeNotFoundError, type PracticeService } from "./practice.service.js";

// Quizzes de práctica.
//   Hosts y admin: crean/editan por clase y ven quién practicó.
//   Alumnas: practican los publicados de su grupo (las respuestas correctas
//   solo se revelan después de contestar).
export function createPracticeRouter(guards: AuthGuards, practice: PracticeService): Router {
  const router = Router();
  const userId = (req: Request) => getAuthUser(req)?.id ?? "";

  // --- Hosts y admin ---
  router.get("/classes/:classId/practice", guards.requireHost, handle(async (req, res) => {
    res.json(await practice.listForClass(param(req, "classId")));
  }));
  router.post("/classes/:classId/practice", guards.requireHost, handle(async (req, res) => {
    res.status(201).json(await practice.create(param(req, "classId"), req.body, userId(req)));
  }));
  router.get("/practice/:id", guards.requireHost, handle(async (req, res) => {
    res.json(await practice.getForHost(param(req, "id")));
  }));
  router.put("/practice/:id", guards.requireHost, handle(async (req, res) => {
    res.json(await practice.update(param(req, "id"), req.body));
  }));
  router.delete("/practice/:id", guards.requireHost, handle(async (req, res) => {
    await practice.delete(param(req, "id"));
    res.status(204).send();
  }));
  router.get("/practice/:id/results", guards.requireHost, handle(async (req, res) => {
    res.json(await practice.studentStats(param(req, "id")));
  }));

  // --- Alumnas ---
  router.get("/me/practice", guards.requireStudent, handle(async (req, res) => {
    res.json(await practice.listForStudent(userId(req)));
  }));
  router.get("/me/practice/:quizId", guards.requireStudent, handle(async (req, res) => {
    res.json(await practice.getForStudent(param(req, "quizId"), userId(req)));
  }));
  router.post("/me/practice/:quizId/attempts", guards.requireStudent, handle(async (req, res) => {
    res.status(201).json(await practice.startAttempt(param(req, "quizId"), userId(req)));
  }));
  router.post("/me/practice-attempts/:attemptId/reveal", guards.requireStudent, handle(async (req, res) => {
    res.json(await practice.revealSolution(param(req, "attemptId"), userId(req), req.body));
  }));
  router.post("/me/practice-attempts/:attemptId/answers", guards.requireStudent, handle(async (req, res) => {
    res.json(await practice.answer(param(req, "attemptId"), userId(req), req.body));
  }));
  router.post("/me/practice-attempts/:attemptId/finish", guards.requireStudent, handle(async (req, res) => {
    res.json(await practice.finishAttempt(param(req, "attemptId"), userId(req)));
  }));

  return router;
}

type Handler = (req: Request, res: Response) => Promise<void>;

function handle(handler: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res);
    } catch (error: unknown) {
      if (error instanceof PracticeInputError) {
        res.status(400).json({ message: error.message });
        return;
      }
      if (error instanceof PracticeNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error instanceof PracticeInUseError) {
        res.status(409).json({ code: "PRACTICE_IN_USE", message: error.message });
        return;
      }
      if (error instanceof PracticeAlreadyAnsweredError) {
        res.status(409).json({ code: "ALREADY_ANSWERED", message: error.message });
        return;
      }
      if (error instanceof PracticeAttemptFinishedError) {
        res.status(409).json({ code: "ATTEMPT_FINISHED", message: error.message });
        return;
      }
      next(error);
    }
  };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}
