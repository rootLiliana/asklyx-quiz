import type { ClassSummary } from "../types/Host";

// "2026-09-28" o "2026-09-28T06:00:00.000Z" -> "2026-09-28"
export function toIsoDay(classDate: string | null): string | null {
  return classDate ? classDate.slice(0, 10) : null;
}

export function todayIsoDay(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// -> "lun 28 sep 2026"
export function formatClassDate(classDate: string | null): string {
  const isoDay = toIsoDay(classDate);
  if (!isoDay) return "sin fecha";
  const date = new Date(`${isoDay}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDay;
  return date.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// La clase de hoy si existe; si no, la próxima; si no, la más reciente.
export function pickDefaultClass(classes: ClassSummary[], today: string = todayIsoDay()): ClassSummary | null {
  const dated = classes
    .filter((classItem) => toIsoDay(classItem.classDate))
    .sort((a, b) => (toIsoDay(a.classDate) ?? "").localeCompare(toIsoDay(b.classDate) ?? ""));

  return (
    dated.find((classItem) => toIsoDay(classItem.classDate) === today) ??
    dated.find((classItem) => (toIsoDay(classItem.classDate) ?? "") > today) ??
    dated.at(-1) ??
    classes[0] ??
    null
  );
}
