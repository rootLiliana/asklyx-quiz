import assert from "node:assert/strict";
import test from "node:test";

import type { ClassRepository } from "../classes/class.repository.js";
import type { ClassItem } from "../classes/class.types.js";
import type { GroupRepository } from "../groups/group.repository.js";
import type { MaterialRepository } from "./material.repository.js";
import { MaterialClassNotFoundError, MaterialInputError, MaterialNotFoundError, MaterialService, validateMaterialInput } from "./material.service.js";
import type { Material, MaterialFields } from "./material.types.js";

const classCdd1: ClassItem = {
  id: "1", moduleId: "1", groupId: "10", name: "Sesión 3", description: null,
  classDate: "2026-10-05", startTime: null, endTime: null, status: "SCHEDULED",
};
const NOW = new Date("2026-10-03T12:00:00Z");

class FakeMaterials implements MaterialRepository {
  items = new Map<string, Material>();
  private nextId = 1;

  async findByClass(classId: string) { return [...this.items.values()].filter((item) => item.classId === classId); }
  async findById(id: string) { return this.items.get(id) ?? null; }
  async create(classId: string, fields: MaterialFields, createdBy: string) {
    const material: Material = {
      id: String(this.nextId++), classId, title: fields.title, blocks: fields.blocks, sortOrder: this.nextId,
      publishedAt: fields.publishedAt?.toISOString() ?? null, createdBy, updatedAt: null,
    };
    this.items.set(material.id, material);
    return material;
  }
  async update(id: string, fields: MaterialFields) {
    const current = this.items.get(id);
    if (!current) return null;
    const updated = { ...current, title: fields.title, blocks: fields.blocks, publishedAt: fields.publishedAt?.toISOString() ?? null };
    this.items.set(id, updated);
    return updated;
  }
  async delete(id: string) { return this.items.delete(id); }
  async findForStudent() { return []; }
}

const classes = { findById: async (id: string) => (id === classCdd1.id ? classCdd1 : null) } as unknown as ClassRepository;
// ana (25) está en el grupo 10; luis (26) en otro grupo.
const groups = { hasMember: async (groupId: string, userId: string) => groupId === "10" && userId === "25" } as unknown as GroupRepository;

function build() {
  const repository = new FakeMaterials();
  return { repository, service: new MaterialService(repository, classes, groups, () => NOW) };
}

const validInput = (publishedAt: string | null) => ({
  title: "  Lectura previa: groupby  ",
  blocks: [
    { type: "text", text: "# Agrupar\\nUsa **groupby**." },
    { type: "code", language: "python", code: "df.groupby('ciudad').mean()" },
    { type: "link", url: "https://pandas.pydata.org", label: "Docs" },
  ],
  publishedAt,
});

test("validates and normalizes a material with text, code and link blocks", () => {
  const fields = validateMaterialInput(validInput(null));
  assert.equal(fields.title, "Lectura previa: groupby");
  assert.deepEqual(fields.blocks.map((block) => block.type), ["text", "code", "link"]);
  assert.equal(fields.publishedAt, null);
});

test("rejects links that are not http(s), empty blocks and unknown block types", () => {
  const withBlock = (block: unknown) => ({ title: "x", blocks: [block] });

  assert.throws(() => validateMaterialInput(withBlock({ type: "link", url: "javascript:alert(1)" })), MaterialInputError);
  assert.throws(() => validateMaterialInput(withBlock({ type: "link", url: "no es url" })), MaterialInputError);
  assert.throws(() => validateMaterialInput(withBlock({ type: "text", text: "   " })), MaterialInputError);
  assert.throws(() => validateMaterialInput(withBlock({ type: "html", html: "<script>" })), MaterialInputError);
  assert.throws(() => validateMaterialInput({ title: "x", blocks: [] }), MaterialInputError);
  assert.throws(() => validateMaterialInput({ title: "", blocks: [{ type: "text", text: "a" }] }), MaterialInputError);
  assert.throws(() => validateMaterialInput({ ...validInput(null), publishedAt: "mañana" }), MaterialInputError);
});

test("an unknown code language falls back to python", () => {
  const fields = validateMaterialInput({ title: "x", blocks: [{ type: "code", language: "cobol", code: "x = 1" }] });
  assert.deepEqual(fields.blocks[0], { type: "code", language: "python", code: "x = 1" });
});

test("hosts create materials only for existing classes", async () => {
  const { service } = build();
  const created = await service.create(classCdd1.id, validInput(null), "1");
  assert.equal(created.classId, classCdd1.id);
  await assert.rejects(service.create("999", validInput(null), "1"), MaterialClassNotFoundError);
});

test("a student only opens published material of a class of her group", async () => {
  const { service } = build();
  const draft = await service.create(classCdd1.id, validInput(null), "1");
  const future = await service.create(classCdd1.id, validInput("2026-10-04T12:00:00Z"), "1");
  const published = await service.create(classCdd1.id, validInput("2026-10-02T12:00:00Z"), "1");

  assert.equal((await service.getForStudent(published.id, "25")).id, published.id);
  await assert.rejects(service.getForStudent(draft.id, "25"), MaterialNotFoundError);
  await assert.rejects(service.getForStudent(future.id, "25"), MaterialNotFoundError);
  // Otro grupo: mismo error que si no existiera.
  await assert.rejects(service.getForStudent(published.id, "26"), MaterialNotFoundError);
  await assert.rejects(service.getForStudent("999", "25"), MaterialNotFoundError);
});

test("update and delete report a material that does not exist", async () => {
  const { service } = build();
  await assert.rejects(service.update("999", validInput(null)), MaterialNotFoundError);
  await assert.rejects(service.delete("999"), MaterialNotFoundError);
  await assert.rejects(service.delete("abc"), MaterialInputError);
});
