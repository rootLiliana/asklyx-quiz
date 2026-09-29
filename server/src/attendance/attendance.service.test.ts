import assert from "node:assert/strict";
import test from "node:test";

import type { ClassRepository } from "../classes/class.repository.js";
import type { ClassItem } from "../classes/class.types.js";
import type { GroupRepository } from "../groups/group.repository.js";
import type { CreateGroupInput, Group, GroupStudent } from "../groups/group.types.js";
import type { UserRepository } from "../users/user.repository.js";
import type { User, UserRole, UserWithPasswordHash } from "../users/user.types.js";
import type { AttendanceRepository } from "./attendance.repository.js";
import {
  AttendanceInputError,
  AttendanceClassNotFoundError,
  AttendanceGroupNotFoundError,
  AttendanceService,
  AttendanceStudentNotAStudentError,
  AttendanceStudentNotFoundError,
  AttendanceStudentNotInGroupError,
} from "./attendance.service.js";
import type { AttendanceRecord, AttendanceStatus, ClassAttendanceEntry, GroupAttendanceMatrix, StudentAttendanceEntry } from "./attendance.types.js";

const existingClass: ClassItem = {
  id: "1",
  moduleId: "1",
  groupId: "1",
  name: "Clase Prueba - Módulo 1",
  description: null,
  classDate: "2026-01-01",
  startTime: "10:00:00",
  endTime: "11:00:00",
  status: "SCHEDULED",
};

const studentInGroup: User = {
  id: "25",
  name: "Ana",
  lastNamePaternal: "Pérez",
  lastNameMaternal: null,
  email: "ana@example.com",
  nickname: "ana",
  role: "STUDENT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const studentOutsideGroup: User = { ...studentInGroup, id: "26", nickname: "maria", name: "María" };

class FakeClassRepository implements ClassRepository {
  async findAll(): Promise<ClassItem[]> { return [existingClass]; }
  async findById(id: string): Promise<ClassItem | null> { return id === existingClass.id ? existingClass : null; }
  async findByGroup(): Promise<ClassItem[]> { return [existingClass]; }
}

class FakeGroupRepository implements GroupRepository {
  async create(input: CreateGroupInput): Promise<Group> { return { id: "1", name: input.name, createdAt: "2026-01-01T00:00:00.000Z" }; }
  async findById(): Promise<Group | null> { return { id: "1", name: "Grupo 1", createdAt: "2026-01-01T00:00:00.000Z" }; }
  async findByName(): Promise<Group | null> { return null; }
  async findAll(): Promise<Group[]> { return []; }
  async findMembers(): Promise<GroupStudent[]> { return []; }
  async hasMember(groupId: string, userId: string): Promise<boolean> {
    return groupId === existingClass.groupId && userId === studentInGroup.id;
  }
  async addMember(): Promise<void> {}
  async removeMember(): Promise<boolean> { return true; }
}

class FakeUserRepository implements UserRepository {
  async create(): Promise<User> { return studentInGroup; }
  async findById(id: string): Promise<User | null> {
    if (id === studentInGroup.id) return studentInGroup;
    if (id === studentOutsideGroup.id) return studentOutsideGroup;
    return null;
  }
  async findByEmail(): Promise<User | null> { return null; }
  async findByNickname(): Promise<User | null> { return null; }
  async findAuthByNickname(): Promise<UserWithPasswordHash | null> { return null; }
  async updateRole(_: string, role: UserRole): Promise<User | null> { return { ...studentInGroup, role }; }
  async findAll(): Promise<User[]> { return [studentInGroup]; }
}

class FakeAttendanceRepository implements AttendanceRepository {
  records = new Map<string, AttendanceStatus>();

  async upsert(classId: string, studentId: string, status: AttendanceStatus): Promise<AttendanceRecord> {
    this.records.set(`${classId}:${studentId}`, status);
    return { id: "1", classId, studentId, status, checkedAt: "2026-01-01T00:00:00.000Z" };
  }

  async findRosterForClass(): Promise<ClassAttendanceEntry[]> {
    return [
      {
        studentId: studentInGroup.id,
        name: studentInGroup.name,
        nickname: studentInGroup.nickname,
        status: this.records.get(`${existingClass.id}:${studentInGroup.id}`) ?? null,
      },
      {
        studentId: studentOutsideGroup.id,
        name: studentOutsideGroup.name,
        nickname: studentOutsideGroup.nickname,
        status: null,
      },
    ];
  }

  async findByStudent(): Promise<StudentAttendanceEntry[]> { return []; }
  async findMatrixForGroup(): Promise<GroupAttendanceMatrix> { return { classes: [], students: [], records: [] }; }
}

function buildService(attendance = new FakeAttendanceRepository()) {
  return new AttendanceService(attendance, new FakeClassRepository(), new FakeUserRepository(), new FakeGroupRepository());
}

test("record validates the class, the student, and its role", async () => {
  const service = buildService();

  await assert.rejects(service.record("999", studentInGroup.id, "PRESENT"), AttendanceClassNotFoundError);
  await assert.rejects(service.record(existingClass.id, "999", "PRESENT"), AttendanceStudentNotFoundError);
  await assert.rejects(service.record(existingClass.id, studentInGroup.id, "UNKNOWN"), AttendanceInputError);
});

test("record rejects a student that is not a STUDENT", async () => {
  const groups = new FakeGroupRepository();
  groups.hasMember = async () => true;
  const users = new FakeUserRepository();
  users.findById = async (id) => (id === "30" ? { ...studentInGroup, id: "30", role: "HOST" } : null);
  const service = new AttendanceService(new FakeAttendanceRepository(), new FakeClassRepository(), users, groups);

  await assert.rejects(service.record(existingClass.id, "30", "PRESENT"), AttendanceStudentNotAStudentError);
});

test("record rejects a student that does not belong to the class's group", async () => {
  const service = buildService();

  await assert.rejects(
    service.record(existingClass.id, studentOutsideGroup.id, "PRESENT"),
    AttendanceStudentNotInGroupError,
  );
});

test("record upserts instead of duplicating an existing attendance row", async () => {
  const attendance = new FakeAttendanceRepository();
  const service = buildService(attendance);

  await service.record(existingClass.id, studentInGroup.id, "PRESENT");
  await service.record(existingClass.id, studentInGroup.id, "LATE");

  assert.equal(attendance.records.size, 1);
  assert.equal(attendance.records.get(`${existingClass.id}:${studentInGroup.id}`), "LATE");
});

test("getClassAttendance includes students without an attendance record yet", async () => {
  const attendance = new FakeAttendanceRepository();
  const service = buildService(attendance);

  await service.record(existingClass.id, studentInGroup.id, "PRESENT");
  const roster = await service.getClassAttendance(existingClass.id);

  assert.deepEqual(
    roster.map((entry) => entry.status),
    ["PRESENT", null],
  );
});

test("getGroupAttendance returns the students x classes matrix of an existing group", async () => {
  const attendance = new FakeAttendanceRepository();
  const matrix = {
    classes: [{ id: existingClass.id, name: existingClass.name, classDate: existingClass.classDate }],
    students: [{ id: studentInGroup.id, name: studentInGroup.name, lastNamePaternal: null, nickname: studentInGroup.nickname }],
    records: [{ classId: existingClass.id, studentId: studentInGroup.id, status: "PRESENT" as const }],
  };
  attendance.findMatrixForGroup = async () => matrix;

  assert.deepEqual(await buildService(attendance).getGroupAttendance("1"), matrix);
});

test("getGroupAttendance rejects an invalid id and a group that does not exist", async () => {
  const groups = new FakeGroupRepository();
  groups.findById = async () => null;
  const service = new AttendanceService(new FakeAttendanceRepository(), new FakeClassRepository(), new FakeUserRepository(), groups);

  await assert.rejects(buildService().getGroupAttendance("abc"), AttendanceInputError);
  await assert.rejects(service.getGroupAttendance("99"), AttendanceGroupNotFoundError);
});
