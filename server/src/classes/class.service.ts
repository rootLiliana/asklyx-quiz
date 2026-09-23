import type { GroupRepository } from "../groups/group.repository.js";
import type { ClassRepository } from "./class.repository.js";
import type { ClassItem } from "./class.types.js";

export class ClassInputError extends Error {}
export class ClassGroupNotFoundError extends Error {}

export class ClassService {
  constructor(
    private readonly classes: ClassRepository,
    private readonly groups: GroupRepository,
  ) {}

  listClasses(): Promise<ClassItem[]> {
    return this.classes.findAll();
  }

  getClass(id: string): Promise<ClassItem | null> {
    return this.classes.findById(validateId(id, "id"));
  }

  async listByGroup(groupId: string): Promise<ClassItem[]> {
    const validGroupId = validateId(groupId, "groupId");
    const group = await this.groups.findById(validGroupId);

    if (!group) {
      throw new ClassGroupNotFoundError("Group not found");
    }

    return this.classes.findByGroup(validGroupId);
  }
}

function validateId(id: string, name: string): string {
  if (!/^\d+$/.test(id)) {
    throw new ClassInputError(`${name} must be a positive integer`);
  }

  return id;
}
