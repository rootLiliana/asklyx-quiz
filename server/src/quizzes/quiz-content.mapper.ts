import type { Question } from "../types/Question.js";
import type {
  CreateStoredQuestion,
  QuizContent,
  StoredQuestion,
} from "./quiz-content.types.js";

export function toStoredQuestions(questions: Question[]): CreateStoredQuestion[] {
  return questions.map((question, questionIndex) => ({
    text: question.text,
    explanation: question.explanation,
    questionOrder: questionIndex + 1,
    points: 1,
    options: question.options.map((text, optionIndex) => ({
      text,
      optionOrder: optionIndex + 1,
      isCorrect: optionIndex === question.correctAnswer,
    })),
  }));
}

export function toGameManagerQuestions(quiz: QuizContent): Question[] {
  return quiz.questions
    .slice()
    .sort((left, right) => left.questionOrder - right.questionOrder)
    .map(toGameManagerQuestion);
}

function toGameManagerQuestion(question: StoredQuestion): Question {
  const orderedOptions = question.options
    .slice()
    .sort((left, right) => left.optionOrder - right.optionOrder);
  const correctOptions = orderedOptions.filter((option) => option.isCorrect);

  if (correctOptions.length !== 1) {
    throw new Error(`Question ${question.id} must have exactly one correct option`);
  }

  const correctAnswer = orderedOptions.findIndex((option) => option.isCorrect);

  return {
    id: question.id,
    text: question.text,
    options: orderedOptions.map((option) => option.text),
    optionIds: orderedOptions.map((option) => option.id),
    correctAnswer,
    explanation: question.explanation ?? "",
    answers: new Array(orderedOptions.length).fill(0),
  };
}
