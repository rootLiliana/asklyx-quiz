// Una respuesta del jugador, tal como se guardará en quiz_answers.
export interface PlayerAnswer {
  questionId: string;
  // null si llegó fuera de tiempo o con una opción inválida.
  optionIndex: number | null;
  correct: boolean;
  points: number;
  // Desde que apareció la pregunta hasta que contestó.
  responseMs: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  answeredQuestions: string[];
  answers: PlayerAnswer[];
}
