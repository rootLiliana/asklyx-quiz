import assert from "node:assert/strict";
import test from "node:test";

import type { ClassRepository } from "../classes/class.repository.js";
import type { ClassItem } from "../classes/class.types.js";
import type { Question } from "../types/Question.js";
import {
  QuizContentClassNotFoundError,
  QuizContentInputError,
  QuizContentHasResultsError,
  QuizContentNotFoundError,
  QuizContentService,
} from "./quiz-content.service.js";
import type { QuizContentRepository } from "./quiz-content.repository.js";
import type { CreateQuizContent, QuizContent, QuizSummary } from "./quiz-content.types.js";

const questions: Question[] = [
  {
    id: "legacy-question-1",
    text: "¿Cuál es la respuesta?",
    options: ["A", "B", "C"],
    correctAnswer: 2,
    explanation: "La respuesta correcta es C porque conserva el índice 2.",
    answers: [0, 0, 0],
  },
  {
    id: "legacy-question-2",
    text: "Segunda pregunta",
    options: ["Sí", "No"],
    correctAnswer: 0,
    explanation: "Sí es correcta.",
    answers: [0, 0],
  },
];

const existingClass: ClassItem = {
  id: "1",
  moduleId: "1",
  groupId: "1",
  name: "Clase Prueba - Módulo 1",
  description: null,
  classDate: "2026-01-01",
  startTime: "10:00:00",
  endTime: "11:00:00",
  status: "SCHEDULED",
};

const secondClass: ClassItem = {
  id: "2",
  moduleId: "2",
  groupId: "2",
  name: "Clase Prueba - Módulo 2",
  description: null,
  classDate: "2026-01-06",
  startTime: "10:00:00",
  endTime: "11:00:00",
  status: "SCHEDULED",
};

class FakeQuizContentRepository implements QuizContentRepository {
  created: CreateQuizContent | undefined;
  private quiz: QuizContent | null = null;

  async create(content: CreateQuizContent): Promise<QuizContent> {
    this.created = content;
    this.quiz = toQuiz("900", content);
    return this.quiz;
  }

  async update(id: string, content: CreateQuizContent): Promise<QuizContent | null> {
    if (this.quiz?.id !== id) return null;
    this.quiz = toQuiz(id, { ...content, createdBy: this.quiz.createdBy });
    return this.quiz;
  }

  async delete(id: string): Promise<boolean> {
    if (this.quiz?.id !== id) return false;
    this.quiz = null;
    return true;
  }

  async findAll(): Promise<QuizSummary[]> { return []; }

  played = false;
  async hasResults(): Promise<boolean> { return this.played; }

  async findById(id: string): Promise<QuizContent | null> {
    return this.quiz?.id === id ? this.quiz : null;
  }
}

function toQuiz(id: string, content: CreateQuizContent): QuizContent {
return {
    id,
    classId: content.classId,
    title: content.title,
    description: content.description,
    timeLimitSeconds: content.timeLimitSeconds,
    createdBy: content.createdBy,
    questions: content.questions.map((question, questionIndex) => ({
      id: String(questionIndex + 100),
      text: question.text,
      explanation: question.explanation,
      questionOrder: question.questionOrder,
      points: question.points,
      options: question.options.map((option, optionIndex) => ({
        id: String(questionIndex * 10 + optionIndex + 1),
        text: option.text,
        optionOrder: option.optionOrder,
        isCorrect: option.isCorrect,
      })),
    })),
  };
}

class FakeClassRepository implements ClassRepository {
  async findAll(): Promise<ClassItem[]> { return [existingClass, secondClass]; }
  async findById(id: string): Promise<ClassItem | null> {
    if (id === existingClass.id) return existingClass;
    if (id === secondClass.id) return secondClass;
    return null;
  }
  async findByGroup(): Promise<ClassItem[]> { return [existingClass]; }
}

function buildService(quizzes = new FakeQuizContentRepository()) {
  return new QuizContentService(quizzes, new FakeClassRepository());
}

test("creates a quiz with ordered questions and options", async () => {
  const repository = new FakeQuizContentRepository();
  const service = buildService(repository);

  await service.create({ classId: existingClass.id, title: "Python", createdBy: "2", questions });

  assert.equal(repository.created?.title, "Python");
  assert.deepEqual(repository.created?.questions.map((question) => question.questionOrder), [1, 2]);
  assert.deepEqual(repository.created?.questions[0]?.options.map((option) => option.optionOrder), [1, 2, 3]);
});

test("stores explanation and exactly one correct option", async () => {
  const repository = new FakeQuizContentRepository();
  const service = buildService(repository);

  await service.create({ classId: existingClass.id, title: "Python", createdBy: "2", questions });

  const storedQuestion = repository.created?.questions[0];
  assert.equal(storedQuestion?.explanation, questions[0]?.explanation);
  assert.equal(storedQuestion?.options.filter((option) => option.isCorrect).length, 1);
  assert.equal(storedQuestion?.options[2]?.isCorrect, true);
});

test("retrieves a quiz and reconstructs Game Manager Question[]", async () => {
  const repository = new FakeQuizContentRepository();
  const service = buildService(repository);
  await service.create({ classId: existingClass.id, title: "Python", createdBy: "2", questions });

  const reconstructed = await service.getGameManagerQuestions("900");

  assert.deepEqual(reconstructed?.map((question) => question.options), [["A", "B", "C"], ["Sí", "No"]]);
  assert.deepEqual(reconstructed?.map((question) => question.correctAnswer), [2, 0]);
  assert.deepEqual(reconstructed?.map((question) => question.explanation), [
    "La respuesta correcta es C porque conserva el índice 2.",
    "Sí es correcta.",
  ]);
  assert.deepEqual(reconstructed?.map((question) => question.answers), [[0, 0, 0], [0, 0]]);
  // Los ids reales de las opciones viajan con la pregunta para guardar la opción elegida.
  assert.deepEqual(reconstructed?.map((question) => question.optionIds?.length), [3, 2]);
});

test("create saves the quiz associated with the selected classId", async () => {
  const repository = new FakeQuizContentRepository();
  const service = buildService(repository);

  const quiz = await service.create({ classId: existingClass.id, title: "Python", createdBy: "2", questions });

  assert.equal(repository.created?.classId, existingClass.id);
  assert.equal(quiz.classId, existingClass.id);
});

test("create rejects a classId that does not exist, without inventing a class", async () => {
  const service = buildService();

  await assert.rejects(
    service.create({ classId: "999", title: "Python", createdBy: "2", questions }),
    QuizContentClassNotFoundError,
  );
});

test("create rejects an invalid (non-numeric) classId", async () => {
  const service = buildService();

  await assert.rejects(
    service.create({ classId: "not-a-number", title: "Python", createdBy: "2", questions }),
    QuizContentInputError,
  );
});

test("update replaces title, class and questions of a saved quiz, keeping its creator", async () => {
  const repository = new FakeQuizContentRepository();
  const service = buildService(repository);
  await service.create({ classId: existingClass.id, title: "Python", createdBy: "2", questions });

  const updated = await service.update("900", {
    classId: secondClass.id,
    title: "  Python - repaso  ",
    createdBy: "7",
    questions: [questions[1]!],
  });

  assert.equal(updated.id, "900");
  assert.equal(updated.classId, secondClass.id);
  assert.equal(updated.title, "Python - repaso");
  assert.equal(updated.createdBy, "2");
  assert.equal(updated.questions.length, 1);
});

test("update rejects a quiz that does not exist and a class that does not exist", async () => {
  const repository = new FakeQuizContentRepository();
  const service = buildService(repository);
  await service.create({ classId: existingClass.id, title: "Python", createdBy: "2", questions });

  await assert.rejects(
    service.update("12345", { classId: existingClass.id, title: "Python", createdBy: "2", questions }),
    QuizContentNotFoundError,
  );
  await assert.rejects(
    service.update("900", { classId: "999", title: "Python", createdBy: "2", questions }),
    QuizContentClassNotFoundError,
  );
});

test("delete removes a saved quiz and rejects an unknown one", async () => {
  const repository = new FakeQuizContentRepository();
  const service = buildService(repository);
  await service.create({ classId: existingClass.id, title: "Python", createdBy: "2", questions });

  await service.delete("900");

  assert.equal(await service.getById("900"), null);
  await assert.rejects(service.delete("900"), QuizContentNotFoundError);
});

test("list rejects a non-numeric classId filter", () => {
  const service = buildService();
  assert.throws(() => service.list("abc"), QuizContentInputError);
});

test("a quiz that already has results cannot be edited or deleted (it is saved as a copy instead)", async () => {
  const repository = new FakeQuizContentRepository();
  const service = buildService(repository);
  await service.create({ classId: existingClass.id, title: "Python", createdBy: "2", questions });
  repository.played = true;

  await assert.rejects(
    service.update("900", { classId: existingClass.id, title: "Python v2", createdBy: "2", questions }),
    QuizContentHasResultsError,
  );
  await assert.rejects(service.delete("900"), QuizContentHasResultsError);
  assert.equal((await service.getById("900"))?.title, "Python");

  // La copia es un quiz nuevo con el contenido editado.
  const copy = await service.create({ classId: existingClass.id, title: "Python (copia)", createdBy: "2", questions: [questions[0]!] });
  assert.equal(copy.title, "Python (copia)");
  assert.equal(copy.questions.length, 1);
});
