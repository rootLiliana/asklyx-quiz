export interface SubmitAnswerResponse {
  correct: boolean;
  alreadyAnswered: boolean;
  // Respondió después de que se acabó el tiempo: 0 puntos.
  timeUp: boolean;
  score: number;
  correctAnswer: number;
  explanation: string;
}
