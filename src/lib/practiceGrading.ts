// Calificación de la vista previa del Host ("Probar como alumno").
// MISMA lógica que server/src/practice/practice.grading.ts: si cambias una,
// cambia la otra. (Para los alumnos siempre califica el servidor.)

export function normalizeShortAnswer(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function asNumber(value: string): number | null {
  const normalized = value.trim().replace(/,(?=\d+$)/, ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function shortAnswerMatches(answer: string, accepted: string[]): boolean {
  const answerNumber = asNumber(answer);
  const normalized = normalizeShortAnswer(answer);
  return accepted.some((option) => {
    const optionNumber = asNumber(option);
    if (answerNumber !== null && optionNumber !== null) return Math.abs(answerNumber - optionNumber) < 1e-9;
    return normalized === normalizeShortAnswer(option);
  });
}

export function normalizeOutput(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

export function outputMatches(answer: string, accepted: string[]): boolean {
  const normalized = normalizeOutput(answer);
  return accepted.some((option) => normalizeOutput(option) === normalized);
}
