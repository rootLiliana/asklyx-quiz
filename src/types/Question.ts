export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  durationSeconds?: number;
  explanation: string;
  // Solo en la vista de la host: cuántas eligieron cada opción.
  answers?: number[];
}
