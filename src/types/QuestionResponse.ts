import type { Question } from "./Question";

export type QuestionResponse =
  | Question
  | { waiting: true }
  | { finished: true };