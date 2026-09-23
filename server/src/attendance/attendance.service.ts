import type { ClassRepository } from "../classes/class.repository.js";
import type { GroupRepository } from "../groups/group.repository.js";
import type { UserRepository } from "../users/user.repository.js";
import type { AttendanceRepository } from "./attendance.repository.js";
import { ATTENDANCE_STATUSES, type AttendanceRecord, type AttendanceStatus, type ClassAttendanceEntry, type StudentAttendanceEntry } from "./attendance.types.js";

export class AttendanceInputError extends Error {}
export class AttendanceClassNotFoundError extends Error {}
export class AttendanceStudentNotFoundError extends Error {}
export class AttendanceStudentNotAStudentError extends Error {}
export class AttendanceStudentNotInGroupError extends Error {}

export class AttendanceService {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly classes: ClassRepository,
    private readonly users: UserRepository,
    private readonly groups: GroupRepository,
  ) {}

  async record(classId: string, studentId: string, status: unknown): Promise<AttendanceRecord> {
    const validClassId = validateId(classId, "classId");
    const validStudentId = validateId(studentId, "studentId");

    if (typeof status !== "string" || !ATTENDANCE_STATUSES.includes(status as AttendanceStatus)) {
      throw new AttendanceInputError(`status must be one of ${ATTENDANCE_STATUSES.join(", ")}`);
    }

    const classItem = await this.classes.findById(validClassId);
    if (!classItem) {
      throw new AttendanceClassNotFoundError("Class not found");
    }

    const student = await this.users.findById(validStudentId);
    if (!student) {
      throw new AttendanceStudentNotFoundError("Student not found");
    }
    if (student.role !== "STUDENT") {
      throw new AttendanceStudentNotAStudentError("Only STUDENT users can have attendance recorded");
    }

    const belongsToGroup = await this.groups.hasMember(classItem.groupId, validStudentId);
    if (!belongsToGroup) {
      throw new AttendanceStudentNotInGroupError("The student does not belong to the group of this class");
    }

    return this.attendance.upsert(validClassId, validStudentId, status as AttendanceStatus);
  }

  async getClassAttendance(classId: string): Promise<ClassAttendanceEntry[]> {
    const validClassId = validateId(classId, "classId");
    const classItem = await this.classes.findById(validClassId);

    if (!classItem) {
      throw new AttendanceClassNotFoundError("Class not found");
    }

    return this.attendance.findRosterForClass(validClassId, classItem.groupId);
  }

  async getStudentAttendance(studentId: string): Promise<StudentAttendanceEntry[]> {
    const validStudentId = validateId(studentId, "studentId");
    const student = await this.users.findById(validStudentId);

    if (!student) {
      throw new AttendanceStudentNotFoundError("Student not found");
    }

    return this.attendance.findByStudent(validStudentId);
  }
}

function validateId(id: string, name: string): string {
  if (!/^\d+$/.test(id)) {
    throw new AttendanceInputError(`${name} must be a positive integer`);
  }

  return id;
}
