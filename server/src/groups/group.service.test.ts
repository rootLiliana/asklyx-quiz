import assert from "node:assert/strict";
import test from "node:test";

import type { UserRepository } from "../users/user.repository.js";
import type { User, UserRole, UserWithPasswordHash } from "../users/user.types.js";
import type { GroupRepository } from "./group.repository.js";
import { GroupMembershipConflictError } from "./group.repository.js";
import {
  GroupInputError,
  GroupMembershipDuplicateError,
  GroupNoScheduledGroupTodayError,
  GroupNotFoundError,
  GroupService,
  GroupUserNotFoundError,
  GroupUserNotStudentError,
} from "./group.service.js";
import type { CreateGroupInput, Group, GroupStudent } from "./group.types.js";
import { CDD1_GROUP_NAME, CDD2_GROUP_NAME } from "./group-schedule.js";

const existingGroup: Group = {
  id: "1",
  name: CDD1_GROUP_NAME,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const secondGroup: Group = {
  id: "2",
  name: CDD2_GROUP_NAME,
  createdAt: "2026-01-01T00:00:00.000Z",
};

// Grupo adicional que NO corresponde a ningún día de la regla, usado para
// demostrar que assignTodayGroupToStudent nunca podría "elegirlo" aunque
// existiera: el método ni siquiera acepta un groupId como parámetro.
const decoyGroup: Group = {
  id: "99",
  name: "Grupo Fantasma",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const MONDAY = new Date(2026, 0, 5, 12, 0, 0);
const FRIDAY = new Date(2026, 0, 9, 12, 0, 0);

const studentUser: User = {
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

const GROUPS_BY_ID = new Map<string, Group>([
  [existingGroup.id, existingGroup],
  [secondGroup.id, secondGroup],
  [decoyGroup.id, decoyGroup],
]);
const GROUPS_BY_NAME = new Map<string, Group>([
  [existingGroup.name, existingGroup],
  [secondGroup.name, secondGroup],
  [decoyGroup.name, decoyGroup],
]);

class FakeGroupRepository implements GroupRepository {
  members = new Set<string>();
  createdInput: CreateGroupInput | undefined;
  addMemberShouldConflict = false;

  async create(input: CreateGroupInput): Promise<Group> {
    this.createdInput = input;
    return { ...existingGroup, name: input.name };
  }

  async findById(id: string): Promise<Group | null> {
    return GROUPS_BY_ID.get(id) ?? null;
  }

  async findByName(name: string): Promise<Group | null> {
    return GROUPS_BY_NAME.get(name) ?? null;
  }

  async findAll(): Promise<Group[]> {
    return [existingGroup];
  }

  async findMembers(): Promise<GroupStudent[]> {
    return [{ id: studentUser.id, name: studentUser.name, nickname: studentUser.nickname, email: studentUser.email }];
  }

  async hasMember(groupId: string, userId: string): Promise<boolean> {
    return this.members.has(`${groupId}:${userId}`);
  }

  async addMember(groupId: string, userId: string): Promise<void> {
    if (this.addMemberShouldConflict) {
      throw new GroupMembershipConflictError("The student already belongs to this group");
    }
    this.members.add(`${groupId}:${userId}`);
  }

  async removeMember(groupId: string, userId: string): Promise<boolean> {
    return this.members.delete(`${groupId}:${userId}`);
  }
}

class FakeUserRepository implements UserRepository {
  async create(): Promise<User> { return studentUser; }
  async findById(id: string): Promise<User | null> { return id === studentUser.id ? studentUser : null; }
  async findByEmail(): Promise<User | null> { return null; }
  async findByNickname(): Promise<User | null> { return null; }
  async findAuthByNickname(): Promise<UserWithPasswordHash | null> { return null; }
  async updateRole(_: string, role: UserRole): Promise<User | null> { return { ...studentUser, role }; }
  async findAll(): Promise<User[]> { return [studentUser]; }
}

test("createGroup trims the name and rejects an empty one", async () => {
  const groups = new FakeGroupRepository();
  const service = new GroupService(groups, new FakeUserRepository());

  const group = await service.createGroup({ name: " Grupo 2 " });
  assert.equal(groups.createdInput?.name, "Grupo 2");
  assert.equal(group.name, "Grupo 2");

  await assert.rejects(service.createGroup({ name: "   " }), GroupInputError);
});

test("addStudent verifies group, user existence, and STUDENT role", async () => {
  const groups = new FakeGroupRepository();
  const service = new GroupService(groups, new FakeUserRepository());

  await assert.rejects(service.addStudent("999", studentUser.id), GroupNotFoundError);
  await assert.rejects(service.addStudent(existingGroup.id, "999"), GroupUserNotFoundError);

  const hostRepository = new FakeUserRepository();
  hostRepository.findById = async (id) => (id === "30" ? { ...studentUser, id: "30", role: "HOST" } : null);
  const serviceWithHost = new GroupService(new FakeGroupRepository(), hostRepository);
  await assert.rejects(serviceWithHost.addStudent(existingGroup.id, "30"), GroupUserNotStudentError);

  await service.addStudent(existingGroup.id, studentUser.id);
  assert.ok(groups.members.has(`${existingGroup.id}:${studentUser.id}`));
});

test("addStudent rejects a duplicate membership without creating another row", async () => {
  const groups = new FakeGroupRepository();
  const service = new GroupService(groups, new FakeUserRepository());

  await service.addStudent(existingGroup.id, studentUser.id);
  await assert.rejects(service.addStudent(existingGroup.id, studentUser.id), GroupMembershipDuplicateError);
  assert.equal(groups.members.size, 1);
});

test("getStudents returns the group's students", async () => {
  const service = new GroupService(new FakeGroupRepository(), new FakeUserRepository());

  const students = await service.getStudents(existingGroup.id);
  assert.equal(students.length, 1);
  assert.equal(students[0]?.id, studentUser.id);

  await assert.rejects(service.getStudents("999"), GroupNotFoundError);
});

test("assignTodayGroupToStudent creates the membership for a valid STUDENT on a scheduled day", async () => {
  const groups = new FakeGroupRepository();
  const service = new GroupService(groups, new FakeUserRepository());

  const group = await service.assignTodayGroupToStudent(studentUser.id, MONDAY);

  assert.equal(group.id, existingGroup.id);
  assert.equal(group.name, CDD1_GROUP_NAME);
  assert.ok(groups.members.has(`${existingGroup.id}:${studentUser.id}`));
});

test("assignTodayGroupToStudent does not duplicate an existing membership", async () => {
  const groups = new FakeGroupRepository();
  const service = new GroupService(groups, new FakeUserRepository());

  await service.assignTodayGroupToStudent(studentUser.id, MONDAY);
  await service.assignTodayGroupToStudent(studentUser.id, MONDAY);

  assert.equal(groups.members.size, 1);
});

test("assignTodayGroupToStudent rejects a non-STUDENT user", async () => {
  const hostRepository = new FakeUserRepository();
  hostRepository.findById = async (id) => (id === "30" ? { ...studentUser, id: "30", role: "HOST" } : null);
  const service = new GroupService(new FakeGroupRepository(), hostRepository);

  await assert.rejects(service.assignTodayGroupToStudent("30", MONDAY), GroupUserNotStudentError);
});

test("assignTodayGroupToStudent rejects an unknown userId", async () => {
  const service = new GroupService(new FakeGroupRepository(), new FakeUserRepository());

  await assert.rejects(service.assignTodayGroupToStudent("999", MONDAY), GroupUserNotFoundError);
});

test("assignTodayGroupToStudent never lets the caller pick a groupId: it always resolves the group purely from the weekday", async () => {
  const groups = new FakeGroupRepository();
  const service = new GroupService(groups, new FakeUserRepository());

  // El método no acepta ningún groupId como parámetro. Aunque el repositorio
  // tenga otros grupos disponibles (incluido uno "señuelo"), el resultado
  // siempre es el que corresponde al día, resuelto internamente por nombre.
  const group = await service.assignTodayGroupToStudent(studentUser.id, MONDAY);

  assert.equal(group.id, existingGroup.id);
  assert.notEqual(group.id, decoyGroup.id);
  assert.notEqual(group.id, secondGroup.id);
});

test("assignTodayGroupToStudent reports a controlled outcome when no group is scheduled today", async () => {
  const service = new GroupService(new FakeGroupRepository(), new FakeUserRepository());

  await assert.rejects(service.assignTodayGroupToStudent(studentUser.id, FRIDAY), GroupNoScheduledGroupTodayError);
});
