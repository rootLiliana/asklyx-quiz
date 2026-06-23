export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  durationSeconds?: number;
}
