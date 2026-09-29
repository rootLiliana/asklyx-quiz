export interface ClassItem {
  id: string;
  moduleId: string;
  groupId: string;
  name: string;
  description: string | null;
  classDate: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
}

// Datos editables de una clase. Fechas "YYYY-MM-DD", horas "HH:MM:SS".
export interface ClassFields {
  moduleId: string;
  groupId: string;
  name: string;
  description: string | null;
  classDate: string;
  startTime: string | null;
  endTime: string | null;
}
