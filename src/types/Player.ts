export interface Player {
  id: string;
  name: string;
  score: number;
  // Solo en la vista de la host (GET /games/:code): ids de las preguntas que ya contestó.
  answeredQuestions?: string[];
}