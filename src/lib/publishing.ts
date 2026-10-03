// Publicación del material y de los quizzes de práctica:
//   null = borrador; fecha pasada = publicado; fecha futura = programado.
export type PublishMode = "draft" | "published" | "scheduled";

export function publishModeOf(publishedAt: string | null): PublishMode {
  if (!publishedAt) return "draft";
  return new Date(publishedAt).getTime() > Date.now() ? "scheduled" : "published";
}

// ISO -> "2026-10-05T18:00" (hora local, para <input type="datetime-local">).
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Fecha a guardar. "Publicado" conserva la fecha original si ya lo estaba.
export function resolvePublishedAt(mode: PublishMode, scheduledAt: string, previous: string | null): string | null {
  if (mode === "draft") return null;
  if (mode === "scheduled") return new Date(scheduledAt).toISOString();
  return previous && publishModeOf(previous) === "published" ? previous : new Date().toISOString();
}

export function initialScheduledAt(previous: string | null): string {
  return previous && publishModeOf(previous) === "scheduled" ? toLocalInput(previous) : "";
}

export function scheduleProblem(mode: PublishMode, scheduledAt: string): string {
  return mode === "scheduled" && (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime()))
    ? "Elige la fecha y hora de publicación."
    : "";
}
