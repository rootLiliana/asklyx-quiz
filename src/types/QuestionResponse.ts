// Pregunta tal como la ve el jugador: sin respuesta correcta ni explicación
// (esas llegan solo después de contestar).
export interface StudentQuestion {
  id: string;
  text: string;
  options: string[];
  durationSeconds: number;
  // Calculado por el servidor: el cronómetro se sincroniza con él.
  remainingSeconds: number;
}

export type QuestionResponse =
  | StudentQuestion
  | { waiting: true }
  | { finished: true };
