import assert from "node:assert/strict";
import test from "node:test";

import type { ClassRepository } from "../classes/class.repository.js";
import type { ClassItem } from "../classes/class.types.js";
import type { MaterialRepository } from "./material.repository.js";
import { MaterialClassNotFoundError, MaterialInputError, MaterialNotFoundError, MaterialService, validateMaterialInput } from "./material.service.js";
import type { Material, MaterialFields } from "./material.types.js";

// "Sesión 3" la tienen los dos grupos: misma sesión (lesson "L3").
const classCdd1: ClassItem = {
  id: "1", moduleId: "1", groupId: "10", name: "Sesión 3", description: null,
  classDate: "2026-10-05", startTime: null, endTime: null, status: "SCHEDULED", lessonId: "L3",
};
const classCdd2: ClassItem = { ...classCdd1, id: "2", groupId: "11", classDate: "2026-10-06" };
const NOW = new Date("2026-10-03T12:00:00Z");

class FakeMaterials implements MaterialRepository {
  items = new Map<string, Material>();
  private nextId = 1;

  async findByLesson(lessonId: string) { return [...this.items.values()].filter((item) => item.lessonId === lessonId); }
  async findById(id: string) { return this.items.get(id) ?? null; }
  async create(lessonId: string, fields: MaterialFields, createdBy: string) {
    const material: Material = {
      id: String(this.nextId++), lessonId, title: fields.title, blocks: fields.blocks, sortOrder: this.nextId,
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
  // ana (25) está en CDD1 y bere (28) en CDD2: ambas tienen la sesión L3. luis (26), ninguna.
  async isLessonVisibleTo(lessonId: string, userId: string) { return lessonId === "L3" && ["25", "28"].includes(userId); }
}

const classes = { findById: async (id: string) => [classCdd1, classCdd2].find((item) => item.id === id) ?? null } as unknown as ClassRepository;

function build() {
  const repository = new FakeMaterials();
  return { repository, service: new MaterialService(repository, classes, () => NOW) };
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
  assert.equal(created.lessonId, "L3");
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

test("material is per session: created from one group's class, both groups' classes list it and both groups' students open it", async () => {
  const { service } = build();
  const material = await service.create(classCdd1.id, validInput("2026-10-02T12:00:00Z"), "1");

  assert.deepEqual((await service.listForClass(classCdd2.id)).map((item) => item.id), [material.id]);
  assert.equal((await service.getForStudent(material.id, "25")).id, material.id);
  assert.equal((await service.getForStudent(material.id, "28")).id, material.id);
  await assert.rejects(service.getForStudent(material.id, "26"), MaterialNotFoundError);
});
