
export interface SubmitAnswerResponse {
  correct: boolean;
  score: number;
  correctAnswer: number;
  explanation: string;
  alreadyAnswered?: boolean;
}