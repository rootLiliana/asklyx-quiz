import { Router, type NextFunction, type Request, type Response } from "express";

import { toGameManagerQuestions } from "./quiz-content.mapper.js";
import { QuizContentConflictError, QuizContentInUseError } from "./quiz-content.repository.js";
import {
  QuizContentClassNotFoundError,
  QuizContentInputError,
  QuizContentHasResultsError,
  QuizContentNotFoundError,
  type QuizContentService,
} from "./quiz-content.service.js";
import type { CreateQuizContentInput, QuizContent } from "./quiz-content.types.js";
import { isValidQuestion } from "./question-validation.js";

type AuthGuard = (req: Request, res: Response, next: NextFunction) => unknown;
type HostUserIdResolver = (req: Request) => string | null;

// Quizzes guardados en quizzes/questions/options. Todas las hosts ven, usan
// y editan todos los quizzes. classId es la clase para la que se creó el quiz
// (referencia); la clase en la que se juega cada vez se elige al crear el
// juego (POST /games). createdBy sale de la sesión ya autenticada, nunca del
// body.
export function createHostQuizRouter(
  requireHost: AuthGuard,
  getHostUserId: HostUserIdResolver,
  quizContentService: QuizContentService,
): Router {
  const router = Router();
  router.use(requireHost);

  router.get("/", async (req, res, next) => {
    try {
      const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
      res.json(await quizContentService.list(classId));
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const quiz = await quizContentService.getById(getPathId(req));
      if (!quiz) {
        res.status(404).json({ message: "Quiz not found" });
        return;
      }
      res.json({ ...toEditableQuiz(quiz), hasResults: await quizContentService.hasResults(quiz.id) });
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const input = parseQuizBody(req, res, getHostUserId);
      if (!input) return;

      const quiz = await quizContentService.create(input);
      res.status(201).json(toEditableQuiz(quiz));
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.put("/:id", async (req, res, next) => {
    try {
      const input = parseQuizBody(req, res, getHostUserId);
      if (!input) return;

      const quiz = await quizContentService.update(getPathId(req), input);
      res.json(toEditableQuiz(quiz));
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      await quizContentService.delete(getPathId(req));
      res.status(204).send();
    } catch (error: unknown) {
      handleError(error, res, next);
    }
  });

  return router;
}

// Valida el body y responde 400/503 por su cuenta; devuelve null en ese caso.
function parseQuizBody(req: Request, res: Response, getHostUserId: HostUserIdResolver): CreateQuizContentInput | null {
  const hostUserId = getHostUserId(req);
  if (!hostUserId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }

  const body = typeof req.body === "object" && req.body !== null ? req.body as Record<string, unknown> : {};
  const classId = typeof body.classId === "number" ? String(body.classId) : body.classId;
  const questions = body.questions;

  if (!Array.isArray(questions) || questions.length === 0 || !questions.every(isValidQuestion)) {
    res.status(400).json({
      message: "Questions must include text, at least two options, and one valid correct answer.",
    });
    return null;
  }

  return {
    classId: typeof classId === "string" ? classId : "",
    title: typeof body.title === "string" ? body.title : "",
    description: typeof body.description === "string" ? body.description : undefined,
    timeLimitSeconds: typeof body.timeLimitSeconds === "number" ? body.timeLimitSeconds : undefined,
    createdBy: hostUserId,
    questions,
  };
}

// Mismo formato de preguntas que usa el editor del Host (Question[]).
function toEditableQuiz(quiz: QuizContent) {
  return {
    id: quiz.id,
    classId: quiz.classId,
    title: quiz.title,
    description: quiz.description,
    timeLimitSeconds: quiz.timeLimitSeconds,
    questions: toGameManagerQuestions(quiz),
  };
}

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof QuizContentInputError) {
    res.status(400).json({ message: error.message });
    return;
  }
  if (error instanceof QuizContentNotFoundError || error instanceof QuizContentClassNotFoundError) {
    res.status(404).json({ message: error.message });
    return;
  }
  if (error instanceof QuizContentHasResultsError) {
    res.status(409).json({ code: "QUIZ_HAS_RESULTS", message: error.message });
    return;
  }
  if (error instanceof QuizContentConflictError || error instanceof QuizContentInUseError) {
    res.status(409).json({ message: error.message });
    return;
  }
  next(error);
}

function getPathId(req: Request): string {
  const id = req.params.id;
  return typeof id === "string" ? id : "";
}
