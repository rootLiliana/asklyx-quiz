import  type { Player } from "./Player.js";
import type { Question } from "./Question.js";

export interface Game {
  code: string;
  players: Player[];
  questions: Question[];
  currentQuestion: number;
  questionDurationSeconds: number;
  icebreaker?: IceBreaker;
  
}

export interface IceBreaker {
  active: boolean;
  question: string;
  answers: {
    id: string;
    text: string;
    playerName: string;
  }[];
}

