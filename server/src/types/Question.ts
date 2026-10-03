export interface Question {
  id: string;
  text: string;
  options: string[];
  // ids de `options` en la BD, en el mismo orden (para guardar la respuesta).
  optionIds?: string[];
  correctAnswer: number;
  explanation: string;
  answers: number[];
}