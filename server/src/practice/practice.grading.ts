import type { PracticeAnswerInput, PracticeQuestion } from "./practice.types.js";

// Respuesta corta: sin importar mayúsculas, acentos ni espacios de más.
export function normalizeShortAnswer(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function asNumber(value: string): number | null {
  const normalized = value.trim().replace(/,(?=\d+$)/, ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function shortAnswerMatches(answer: string, accepted: string[]): boolean {
  const answerNumber = asNumber(answer);
  const normalized = normalizeShortAnswer(answer);

  return accepted.some((option) => {
    const optionNumber = asNumber(option);
    // 42, 42.0 y 42,0 son lo mismo.
    if (answerNumber !== null && optionNumber !== null) {
      return Math.abs(answerNumber - optionNumber) < 1e-9;
    }
    return normalized === normalizeShortAnswer(option);
  });
}

// Salida de código: se compara línea por línea (sí importan mayúsculas y
// el contenido), ignorando espacios al final de cada línea y líneas vacías
// al inicio o al final.
export function normalizeOutput(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

export function outputMatches(answer: string, accepted: string[]): boolean {
  const normalized = normalizeOutput(answer);
  return accepted.some((option) => normalizeOutput(option) === normalized);
}

export class PracticeAnswerInputError extends Error {}

// ¿Es correcta? Lanza PracticeAnswerInputError si la respuesta no tiene la
// forma que pide ese tipo de pregunta.
export function gradeAnswer(question: PracticeQuestion, answer: PracticeAnswerInput): boolean {
  switch (question.type) {
    case "MULTIPLE_CHOICE": {
      const option = question.options.find((item) => item.id === answer.optionId);
      if (!option) throw new PracticeAnswerInputError("choose one of the options");
      return option.isCorrect;
    }
    case "SHORT_ANSWER":
      if (!answer.answerText?.trim()) throw new PracticeAnswerInputError("write your answer");
      return shortAnswerMatches(answer.answerText, question.acceptedAnswers);
    case "CODE_OUTPUT":
      if (!answer.answerText?.trim()) throw new PracticeAnswerInputError("write the output");
      return outputMatches(answer.answerText, question.acceptedAnswers);
    case "CODE_WRITING":
      if (!answer.answerText?.trim()) throw new PracticeAnswerInputError("write your code");
      if (typeof answer.selfAssessment !== "boolean") throw new PracticeAnswerInputError("say whether you got it right");
      return answer.selfAssessment;
  }
}
