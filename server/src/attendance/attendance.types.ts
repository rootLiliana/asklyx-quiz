export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "JUSTIFIED"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface AttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  status: AttendanceStatus;
  checkedAt: string;
}

export interface ClassAttendanceEntry {
  studentId: string;
  name: string;
  nickname: string;
  status: AttendanceStatus | null;
}

export interface StudentAttendanceEntry {
  classId: string;
  className: string;
  classDate: string | null;
  status: AttendanceStatus;
  checkedAt: string;
}

// Tabla de asistencia de un grupo: alumnos x clases.
export interface GroupAttendanceMatrix {
  classes: { id: string; name: string; classDate: string | null }[];
  students: { id: string; name: string; lastNamePaternal: string | null; nickname: string | null }[];
  // Solo las celdas que tienen registro; una celda sin registro = sin asistencia.
  records: { classId: string; studentId: string; status: AttendanceStatus }[];
}
