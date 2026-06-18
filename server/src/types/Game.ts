import { Player } from "./Player";
import type { Question } from "./Question";

export interface Game {
  code: string;
  players: Player[];
  questions: Question[];
  currentQuestion: number;
}