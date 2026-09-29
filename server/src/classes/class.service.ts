import type { GroupRepository } from "../groups/group.repository.js";
import type { Module, ModuleRepository } from "../modules/module.repository.js";
import type { ClassWriteRepository } from "./class.repository.js";
import type { ClassFields, ClassItem } from "./class.types.js";

export class ClassInputError extends Error {}
export class ClassGroupNotFoundError extends Error {}
export class ClassModuleNotFoundError extends Error {}
export class ClassNotFoundError extends Error {}

const MAX_NAME_LENGTH = 200; // classes.name varchar(200)

// Lo que envía el Host (valores sin validar).
export interface ClassInput {
  moduleId: unknown;
  groupId: unknown;
  name: unknown;
  description?: unknown;
  classDate: unknown;
  startTime?: unknown;
  endTime?: unknown;
}

// Una misma clase (tema) para uno o varios grupos, cada uno en su fecha.
export interface ClassBatchInput {
  moduleId: unknown;
  name: unknown;
  description?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  sessions: unknown;
}

export class ClassService {
  constructor(
    private readonly classes: ClassWriteRepository,
    private readonly groups: GroupRepository,
    private readonly modules: ModuleRepository,
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

  listModules(): Promise<Module[]> {
    return this.modules.findAll();
  }

  async createClasses(input: ClassBatchInput): Promise<ClassItem[]> {
    if (!Array.isArray(input.sessions) || input.sessions.length === 0) {
      throw new ClassInputError("sessions must include at least one { groupId, classDate }");
    }

    const fields = input.sessions.map((session: unknown) => {
      const record = typeof session === "object" && session !== null ? session as Record<string, unknown> : {};
      return normalizeFields({ ...input, groupId: record.groupId, classDate: record.classDate });
    });

    await Promise.all(fields.map((item) => this.assertReferencesExist(item)));
    return this.classes.createMany(fields);
  }

  async updateClass(id: string, input: ClassInput): Promise<ClassItem> {
    const validId = validateId(id, "id");
    const fields = normalizeFields(input);
    await this.assertReferencesExist(fields);

    const updated = await this.classes.update(validId, fields);
    if (!updated) {
      throw new ClassNotFoundError("Class not found");
    }

    return updated;
  }

  async deleteClass(id: string): Promise<void> {
    const deleted = await this.classes.delete(validateId(id, "id"));
    if (!deleted) {
      throw new ClassNotFoundError("Class not found");
    }
  }

  private async assertReferencesExist(fields: ClassFields): Promise<void> {
    const [module, group] = await Promise.all([
      this.modules.findById(fields.moduleId),
      this.groups.findById(fields.groupId),
    ]);

    if (!module) {
      throw new ClassModuleNotFoundError("Module not found");
    }
    if (!group) {
      throw new ClassGroupNotFoundError("Group not found");
    }
  }
}

function normalizeFields(input: ClassInput): ClassFields {
  const moduleId = validateId(toIdString(input.moduleId), "moduleId");
  const groupId = validateId(toIdString(input.groupId), "groupId");

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    throw new ClassInputError("name is required");
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new ClassInputError(`name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  const description = typeof input.description === "string" && input.description.trim() ? input.description.trim() : null;
  const classDate = validateDate(input.classDate);
  const startTime = normalizeTime(input.startTime, "startTime");
  const endTime = normalizeTime(input.endTime, "endTime");

  if (startTime && endTime && endTime <= startTime) {
    throw new ClassInputError("endTime must be after startTime");
  }

  return { moduleId, groupId, name, description, classDate, startTime, endTime };
}

function toIdString(value: unknown): string {
  if (typeof value === "number") return String(value);
  return typeof value === "string" ? value : "";
}

function validateId(id: string, name: string): string {
  if (!/^\d+$/.test(id)) {
    throw new ClassInputError(`${name} must be a positive integer`);
  }

  return id;
}

// "YYYY-MM-DD" y una fecha que exista (rechaza 2026-02-30).
function validateDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ClassInputError("classDate must be YYYY-MM-DD");
  }

  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new ClassInputError("classDate is not a valid date");
  }

  return value;
}

// Vacío -> null; "HH:MM" o "HH:MM:SS" -> "HH:MM:SS".
function normalizeTime(value: unknown, name: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const match = typeof value === "string" ? /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value) : null;
  if (!match) {
    throw new ClassInputError(`${name} must be HH:MM`);
  }

  return `${match[1]}:${match[2]}:${match[3] ?? "00"}`;
}
