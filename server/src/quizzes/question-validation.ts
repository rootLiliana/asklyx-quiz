import type { Question } from "../types/Question.js";

export function isValidQuestion(
  question: unknown
): question is Question {
  if (
    typeof question !== "object" ||
    question === null
  ) {
    return false;
  }

  const candidate =
    question as Partial<Question>;

  return (
    typeof candidate.text === "string" &&
    candidate.text.trim().length > 0 &&

    typeof candidate.explanation === "string" &&
    candidate.explanation.trim().length > 0 &&

    Array.isArray(candidate.options) &&
    candidate.options.length >= 2 &&
    candidate.options.every(
      (option) =>
        typeof option === "string" &&
        option.trim().length > 0
    ) &&

    typeof candidate.correctAnswer ===
      "number" &&
    Number.isInteger(
      candidate.correctAnswer
    ) &&
    candidate.correctAnswer >= 0 &&
    candidate.correctAnswer <
      candidate.options.length
  );
}
