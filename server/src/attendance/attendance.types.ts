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
