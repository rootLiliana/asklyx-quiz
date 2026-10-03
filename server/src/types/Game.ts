import  type { Player } from "./Player.js";
import type { Question } from "./Question.js";

export interface Game {
  code: string;
  players: Player[];
  questions: Question[];
  currentQuestion: number;
  questionDurationSeconds: number;
  // Momento (ms) en que empezó la pregunta actual: el tiempo lo mide el
  // servidor, nunca el navegador.
  questionStartedAt?: number;
  // Cuándo se inició el juego (started_at de cada intento guardado).
  startedAt?: number;
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

