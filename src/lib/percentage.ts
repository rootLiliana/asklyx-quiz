// Colores para un % de aciertos (mismos cortes que la tabla de asistencia).
export function percentageTextClass(percentage: number): string {
  if (percentage >= 80) return "text-green-300";
  if (percentage >= 60) return "text-yellow-300";
  return "text-red-300";
}

export function percentageBarClass(percentage: number): string {
  if (percentage >= 80) return "bg-green-500";
  if (percentage >= 60) return "bg-yellow-400";
  return "bg-red-500";
}
