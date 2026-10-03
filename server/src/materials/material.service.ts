import type { ClassRepository } from "../classes/class.repository.js";
import type { MaterialRepository } from "./material.repository.js";
import { CODE_LANGUAGES, type CodeLanguage, type Material, type MaterialBlock, type MaterialFields, type MaterialViewReport, type StudentClassMaterials } from "./material.types.js";

export class MaterialInputError extends Error {}
export class MaterialNotFoundError extends Error {}
export class MaterialClassNotFoundError extends Error {}

const MAX_TITLE = 200;
const MAX_BLOCKS = 60;
const MAX_TEXT = 20_000;
const MAX_URL = 2_000;
const MAX_LABEL = 200;

function validateId(id: string, name: string): string {
  if (!/^\d+$/.test(id)) {
    throw new MaterialInputError(`${name} must be a positive integer`);
  }
  return id;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function validateBlock(raw: unknown, index: number): MaterialBlock {
  const block = asRecord(raw);
  const where = `block ${index + 1}`;

  if (block.type === "text") {
    if (typeof block.text !== "string" || !block.text.trim()) throw new MaterialInputError(`${where}: text is required`);
    if (block.text.length > MAX_TEXT) throw new MaterialInputError(`${where}: text is too long`);
    return { type: "text", text: block.text };
  }

  if (block.type === "code") {
    if (typeof block.code !== "string" || !block.code.trim()) throw new MaterialInputError(`${where}: code is required`);
    if (block.code.length > MAX_TEXT) throw new MaterialInputError(`${where}: code is too long`);
    const language = typeof block.language === "string" && CODE_LANGUAGES.includes(block.language as CodeLanguage)
      ? block.language as CodeLanguage
      : "python";
    return { type: "code", language, code: block.code };
  }

  if (block.type === "link") {
    const url = typeof block.url === "string" ? block.url.trim() : "";
    // Solo http(s): evita enlaces "javascript:" u otros esquemas peligrosos.
    const parsed = URL.canParse(url) ? new URL(url) : null;
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:") || url.length > MAX_URL) {
      throw new MaterialInputError(`${where}: url must be a valid http(s) link`);
    }
    const label = typeof block.label === "string" ? block.label.trim().slice(0, MAX_LABEL) : "";
    return { type: "link", url, label };
  }

  throw new MaterialInputError(`${where}: type must be text, code or link`);
}

export function validateMaterialInput(input: unknown): MaterialFields {
  const body = asRecord(input);

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) throw new MaterialInputError("title is required");
  if (title.length > MAX_TITLE) throw new MaterialInputError(`title must be at most ${MAX_TITLE} characters`);

  if (!Array.isArray(body.blocks) || body.blocks.length === 0) {
    throw new MaterialInputError("add at least one block");
  }
  if (body.blocks.length > MAX_BLOCKS) {
    throw new MaterialInputError(`at most ${MAX_BLOCKS} blocks`);
  }
  const blocks = body.blocks.map(validateBlock);

  // null / ausente = borrador.
  let publishedAt: Date | null = null;
  if (body.publishedAt !== undefined && body.publishedAt !== null) {
    const date = typeof body.publishedAt === "string" ? new Date(body.publishedAt) : null;
    if (!date || Number.isNaN(date.getTime())) {
      throw new MaterialInputError("publishedAt must be a valid date or null");
    }
    publishedAt = date;
  }

  return { title, blocks, publishedAt };
}

export class MaterialService {
  constructor(
    private readonly materials: MaterialRepository,
    private readonly classes: ClassRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // --- Hosts y admin ---

  // El material es de la sesión de esa clase (compartida entre grupos).
  private async lessonOf(classId: string): Promise<string> {
    const classItem = await this.classes.findById(validateId(classId, "classId"));
    if (!classItem?.lessonId) {
      throw new MaterialClassNotFoundError("Class not found");
    }
    return classItem.lessonId;
  }

  async listForClass(classId: string): Promise<Material[]> {
    return this.materials.findByLesson(await this.lessonOf(classId));
  }

  async create(classId: string, input: unknown, createdBy: string): Promise<Material> {
    const fields = validateMaterialInput(input);
    return this.materials.create(await this.lessonOf(classId), fields, createdBy);
  }

  async viewReport(classId: string): Promise<MaterialViewReport> {
    return this.materials.viewReport(await this.lessonOf(classId));
  }

  async update(id: string, input: unknown): Promise<Material> {
    const updated = await this.materials.update(validateId(id, "id"), validateMaterialInput(input));
    if (!updated) throw new MaterialNotFoundError("Material not found");
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!(await this.materials.delete(validateId(id, "id")))) {
      throw new MaterialNotFoundError("Material not found");
    }
  }

  // --- Alumnas: solo material publicado de las clases de su grupo ---

  listForStudent(userId: string): Promise<StudentClassMaterials[]> {
    return this.materials.findForStudent(userId, this.now());
  }

  async getForStudent(id: string, userId: string): Promise<Material> {
    const material = await this.materials.findById(validateId(id, "id"));
    const isPublished = material?.publishedAt !== null && material?.publishedAt !== undefined
      && new Date(material.publishedAt).getTime() <= this.now().getTime();
    const isMember = material ? await this.materials.isLessonVisibleTo(material.lessonId, userId) : false;

    // Mismo error si no existe, no está publicado o no es de su grupo: no
    // revela que hay material escondido.
    if (!material || !isPublished || !isMember) {
      throw new MaterialNotFoundError("Material not found");
    }

    // Si no se puede anotar, igual se muestra el material.
    try {
      await this.materials.recordView(material.id, userId);
    } catch (error: unknown) {
      console.error("No se pudo anotar la apertura del material", error);
    }
    return material;
  }
}
