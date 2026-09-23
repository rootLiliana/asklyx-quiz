// Regla académica fija: día de la semana -> nombre del grupo que tiene clase.
// getDay(): 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado.
const WEEKDAY_GROUP_NAME: Record<number, string> = {
  1: "Grupo 1",
  3: "Grupo 1",
  2: "Grupo 2",
  4: "Grupo 2",
};

// Solo determina el nombre del grupo del día para uso interno del frontend.
// No existe todavía un endpoint público que permita usar este valor para
// inscribir automáticamente a la alumna en ese grupo (ver nota en el reporte final).
export function getTodayGroupName(date: Date = new Date()): string | null {
  return WEEKDAY_GROUP_NAME[date.getDay()] ?? null;
}
