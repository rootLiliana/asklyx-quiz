export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Regla académica fija. getDay(): 0=domingo, 1=lunes, 2=martes, 3=miércoles,
// 4=jueves, 5=viernes, 6=sábado. Viernes/sábado/domingo no tienen grupo.
// Debe coincidir con src/lib/studentGroup.ts (frontend) y con
// user_groups.name en la BD.
export const CDD1_GROUP_NAME = "Tecnolochicas PRO - CDD1 2026";
export const CDD2_GROUP_NAME = "Tecnolochicas PRO - CDD2 2026";

const WEEKDAY_GROUP_NAME: Partial<Record<Weekday, string>> = {
  1: CDD1_GROUP_NAME,
  3: CDD1_GROUP_NAME,
  2: CDD2_GROUP_NAME,
  4: CDD2_GROUP_NAME,
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
