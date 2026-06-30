export interface IceBreaker {
  active: boolean;
  question: string;
  answers: {
    id: string;
    playerName: string;
    text: string;
  }[];
}