export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Regla académica fija. getDay(): 0=domingo, 1=lunes, 2=martes, 3=miércoles,
// 4=jueves, 5=viernes, 6=sábado. Viernes/sábado/domingo no tienen grupo.
const WEEKDAY_GROUP_NAME: Partial<Record<Weekday, string>> = {
  1: "Grupo 1",
  3: "Grupo 1",
  2: "Grupo 2",
  4: "Grupo 2",
};

export function getGroupNameForWeekday(weekday: Weekday): string | null {
  return WEEKDAY_GROUP_NAME[weekday] ?? null;
}

// Recibe la fecha de referencia como parámetro (nunca lee el reloj del sistema
// por su cuenta) para que quien llama pueda inyectarla y las pruebas sean
// deterministas.
export function getGroupNameForDate(date: Date): string | null {
  return getGroupNameForWeekday(date.getDay() as Weekday);
}
