import  type { Player } from "./Player.js";
import type { Question } from "./Question.js";

export interface Game {
  code: string;
  players: Player[];
  questions: Question[];
  currentQuestion: number;
  questionDurationSeconds: number;
}
