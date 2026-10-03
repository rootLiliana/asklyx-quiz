import type { UserRepository } from "../users/user.repository.js";
import { getGroupNameForDate } from "./group-schedule.js";
import type { GroupRepository } from "./group.repository.js";
import { GroupConflictError, GroupMembershipConflictError } from "./group.repository.js";
import type { CreateGroupInput, Group, GroupMembership, GroupStudent } from "./group.types.js";

export class GroupInputError extends Error {}
export class GroupNotFoundError extends Error {}
export class GroupNameConflictError extends Error {}
export class GroupUserNotFoundError extends Error {}
export class GroupUserNotStudentError extends Error {}
export class GroupMembershipDuplicateError extends Error {}
export class GroupMembershipNotFoundError extends Error {}
export class GroupNoScheduledGroupTodayError extends Error {}

export class GroupService {
  constructor(
    private readonly groups: GroupRepository,
    private readonly users: UserRepository,
  ) {}

  async createGroup(input: CreateGroupInput): Promise<Group> {
    const name = input.name?.trim();

    if (!name) {
      throw new GroupInputError("name is required");
    }

    if (name.length > 100) {
      throw new GroupInputError("name must be at most 100 characters");
    }

    try {
      return await this.groups.create({ name });
    } catch (error: unknown) {
      if (error instanceof GroupConflictError) {
        throw new GroupNameConflictError(error.message);
      }

      throw error;
    }
  }

  listGroups(): Promise<Group[]> {
    return this.groups.findAll();
  }

  getGroup(id: string): Promise<Group | null> {
    return this.groups.findById(validateId(id, "id"));
  }

  async getStudents(groupId: string): Promise<GroupStudent[]> {
    const validGroupId = validateId(groupId, "groupId");
    const group = await this.groups.findById(validGroupId);

    if (!group) {
      throw new GroupNotFoundError("Group not found");
    }

    return this.groups.findMembers(validGroupId);
  }

  async addStudent(groupId: string, userId: string): Promise<void> {
    const validGroupId = validateId(groupId, "groupId");
    const validUserId = validateId(userId, "userId");

    const group = await this.groups.findById(validGroupId);
    if (!group) {
      throw new GroupNotFoundError("Group not found");
    }

    const user = await this.users.findById(validUserId);
    if (!user) {
      throw new GroupUserNotFoundError("User not found");
    }
    if (user.role !== "STUDENT") {
      throw new GroupUserNotStudentError("Only STUDENT users can be added to a group");
    }

    const alreadyMember = await this.groups.hasMember(validGroupId, validUserId);
    if (alreadyMember) {
      throw new GroupMembershipDuplicateError("The student already belongs to this group");
    }

    try {
      await this.groups.addMember(validGroupId, validUserId);
    } catch (error: unknown) {
      if (error instanceof GroupMembershipConflictError) {
        throw new GroupMembershipDuplicateError(error.message);
      }

      throw error;
    }
  }

  // Asocia al estudiante autenticado (userId ya resuelto a partir de su sesión,
  // nunca de un groupId enviado por el cliente) al grupo que corresponde al
  // día de `referenceDate` según la regla académica fija. Idempotente: si ya
  // pertenece al grupo, no duplica la membership.
  async assignTodayGroupToStudent(userId: string, referenceDate: Date = new Date()): Promise<Group> {
    const validUserId = validateId(userId, "userId");

    const groupName = getGroupNameForDate(referenceDate);
    if (!groupName) {
      throw new GroupNoScheduledGroupTodayError("No group is scheduled for today");
    }

    const user = await this.users.findById(validUserId);
    if (!user) {
      throw new GroupUserNotFoundError("User not found");
    }
    if (user.role !== "STUDENT") {
      throw new GroupUserNotStudentError("Only STUDENT users can be assigned to a group");
    }

    const group = await this.groups.findByName(groupName);
    if (!group) {
      throw new GroupNotFoundError(`Group "${groupName}" not found`);
    }

    const alreadyMember = await this.groups.hasMember(group.id, validUserId);
    if (!alreadyMember) {
      try {
        await this.groups.addMember(group.id, validUserId);
      } catch (error: unknown) {
        // Carrera concurrente: si ya quedó como miembro entre el hasMember y
        // el addMember, el resultado final (es miembro) es el deseado.
        if (!(error instanceof GroupMembershipConflictError)) {
          throw error;
        }
      }
    }

    return group;
  }

  listMemberships(): Promise<GroupMembership[]> {
    return this.groups.findAllMemberships();
  }

  // La admin inscribe a una alumna en su grupo (o la deja sin grupo con
  // null). Una alumna queda en un solo grupo: se quita de los demás.
  async setStudentGroup(userId: string, groupId: unknown): Promise<void> {
    const validUserId = validateId(userId, "userId");
    const validGroupId = groupId === null ? null : validateId(typeof groupId === "string" ? groupId : String(groupId ?? ""), "groupId");

    const user = await this.users.findById(validUserId);
    if (!user) {
      throw new GroupUserNotFoundError("User not found");
    }
    if (user.role !== "STUDENT") {
      throw new GroupUserNotStudentError("Only STUDENT users can be assigned to a group");
    }
    if (validGroupId && !(await this.groups.findById(validGroupId))) {
      throw new GroupNotFoundError("Group not found");
    }

    await this.groups.setOnlyGroup(validUserId, validGroupId);
  }

  async removeStudent(groupId: string, studentId: string): Promise<void> {
    const validGroupId = validateId(groupId, "groupId");
    const validStudentId = validateId(studentId, "studentId");

    const removed = await this.groups.removeMember(validGroupId, validStudentId);
    if (!removed) {
      throw new GroupMembershipNotFoundError("The student does not belong to this group");
    }
  }
}

function validateId(id: string, name: string): string {
  if (!/^\d+$/.test(id)) {
    throw new GroupInputError(`${name} must be a positive integer`);
  }

  return id;
}
