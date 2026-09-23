import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";
import type {
  AttendanceRecord,
  AttendanceStatus,
  ClassAttendanceEntry,
  StudentAttendanceEntry,
} from "./attendance.types.js";

interface AttendanceRow extends RowDataPacket {
  id: number | string;
  class_id: number | string;
  student_id: number | string;
  status: AttendanceStatus;
  checked_at: Date | string;
}

interface RosterRow extends RowDataPacket {
  student_id: number | string;
  name: string;
  nickname: string;
  status: AttendanceStatus | null;
}

interface StudentAttendanceRow extends RowDataPacket {
  class_id: number | string;
  class_name: string;
  class_date: Date | string | null;
  status: AttendanceStatus;
  checked_at: Date | string;
}

export interface AttendanceRepository {
  upsert(classId: string, studentId: string, status: AttendanceStatus): Promise<AttendanceRecord>;
  findRosterForClass(classId: string, groupId: string): Promise<ClassAttendanceEntry[]>;
  findByStudent(studentId: string): Promise<StudentAttendanceEntry[]>;
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function serializeNullableDate(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function toAttendanceRecord(row: AttendanceRow): AttendanceRecord {
  return {
    id: String(row.id),
    classId: String(row.class_id),
    studentId: String(row.student_id),
    status: row.status,
    checkedAt: serializeDate(row.checked_at),
  };
}

export class MysqlAttendanceRepository implements AttendanceRepository {
  async upsert(classId: string, studentId: string, status: AttendanceStatus): Promise<AttendanceRecord> {
    await getDatabasePool().execute<ResultSetHeader>(
      `INSERT INTO attendance (class_id, student_id, status, checked_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE status = VALUES(status), checked_at = CURRENT_TIMESTAMP`,
      [classId, studentId, status],
    );

    const record = await this.findByClassAndStudent(classId, studentId);

    if (!record) {
      throw new Error("Attendance was recorded but could not be retrieved");
    }

    return record;
  }

  async findByClassAndStudent(classId: string, studentId: string): Promise<AttendanceRecord | null> {
    const [rows] = await getDatabasePool().execute<AttendanceRow[]>(
      "SELECT id, class_id, student_id, status, checked_at FROM attendance WHERE class_id = ? AND student_id = ? LIMIT 1",
      [classId, studentId],
    );

    const row = rows[0];
    return row ? toAttendanceRecord(row) : null;
  }

  async findRosterForClass(classId: string, groupId: string): Promise<ClassAttendanceEntry[]> {
    const [rows] = await getDatabasePool().execute<RosterRow[]>(
      `SELECT u.id AS student_id, u.name, u.nickname, a.status
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       LEFT JOIN attendance a ON a.class_id = ? AND a.student_id = u.id
       WHERE gm.group_id = ?
       ORDER BY u.name ASC`,
      [classId, groupId],
    );

    return rows.map((row) => ({
      studentId: String(row.student_id),
      name: row.name,
      nickname: row.nickname,
      status: row.status,
    }));
  }

  async findByStudent(studentId: string): Promise<StudentAttendanceEntry[]> {
    const [rows] = await getDatabasePool().execute<StudentAttendanceRow[]>(
      `SELECT a.class_id, c.name AS class_name, c.class_date, a.status, a.checked_at
       FROM attendance a
       JOIN classes c ON c.id = a.class_id
       WHERE a.student_id = ?
       ORDER BY c.class_date DESC, a.checked_at DESC`,
      [studentId],
    );

    return rows.map((row) => ({
      classId: String(row.class_id),
      className: row.class_name,
      classDate: serializeNullableDate(row.class_date),
      status: row.status,
      checkedAt: serializeDate(row.checked_at),
    }));
  }
}
