// Regla académica fija: día de la semana -> nombre del grupo que tiene clase.
// getDay(): 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado.
// Debe coincidir con server/src/groups/group-schedule.ts y con user_groups.name.
const CDD1_GROUP_NAME = "Tecnolochicas PRO - CDD1 2026";
const CDD2_GROUP_NAME = "Tecnolochicas PRO - CDD2 2026";

const WEEKDAY_GROUP_NAME: Record<number, string> = {
  1: CDD1_GROUP_NAME,
  3: CDD1_GROUP_NAME,
  2: CDD2_GROUP_NAME,
  4: CDD2_GROUP_NAME,
};

// Nombre del grupo que tiene clase hoy: lo usan el saludo de la alumna y la
// sugerencia de grupo en "Nueva sesión" del Host.
export function getTodayGroupName(date: Date = new Date()): string | null {
  return WEEKDAY_GROUP_NAME[date.getDay()] ?? null;
}

// Días de la semana (getDay()) en que tiene clase un grupo; [] si no está en la regla.
export function getWeekdaysForGroup(groupName: string): number[] {
  return Object.entries(WEEKDAY_GROUP_NAME)
    .filter(([, name]) => name === groupName)
    .map(([weekday]) => Number(weekday));
}
