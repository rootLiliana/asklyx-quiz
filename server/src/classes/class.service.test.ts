import assert from "node:assert/strict";
import test from "node:test";

import type { GroupRepository } from "../groups/group.repository.js";
import type { Group } from "../groups/group.types.js";
import type { Module, ModuleRepository } from "../modules/module.repository.js";
import type { ClassWriteRepository } from "./class.repository.js";
import {
  ClassGroupNotFoundError,
  ClassInputError,
  ClassModuleNotFoundError,
  ClassNotFoundError,
  ClassService,
} from "./class.service.js";
import type { ClassFields, ClassItem } from "./class.types.js";

const cdd1: Group = { id: "10", name: "Tecnolochicas PRO - CDD1 2026", createdAt: "2026-01-01T00:00:00.000Z" };
const cdd2: Group = { id: "11", name: "Tecnolochicas PRO - CDD2 2026", createdAt: "2026-01-01T00:00:00.000Z" };
const pandas: Module = { id: "3", name: "Pandas", description: null, orderNumber: 3 };

class FakeClassRepository implements ClassWriteRepository {
  readonly items = new Map<string, ClassItem>();
  private nextId = 1;

  async findAll(): Promise<ClassItem[]> { return [...this.items.values()]; }
  async findById(id: string): Promise<ClassItem | null> { return this.items.get(id) ?? null; }
  async findByGroup(groupId: string): Promise<ClassItem[]> {
    return [...this.items.values()].filter((item) => item.groupId === groupId);
  }
  async createMany(classes: ClassFields[]): Promise<ClassItem[]> {
    return classes.map((fields) => {
      const item: ClassItem = { id: String(this.nextId++), status: "SCHEDULED", ...fields };
      this.items.set(item.id, item);
      return item;
    });
  }
  async update(id: string, fields: ClassFields): Promise<ClassItem | null> {
    const current = this.items.get(id);
    if (!current) return null;
    const updated = { ...current, ...fields };
    this.items.set(id, updated);
    return updated;
  }
  async delete(id: string): Promise<boolean> { return this.items.delete(id); }
}

const groups = {
  findById: async (id: string) => [cdd1, cdd2].find((group) => group.id === id) ?? null,
} as unknown as GroupRepository;

const modules: ModuleRepository = {
  findAll: async () => [pandas],
  findById: async (id: string) => (id === pandas.id ? pandas : null),
};

function build() {
  const repository = new FakeClassRepository();
  return { repository, service: new ClassService(repository, groups, modules) };
}

const baseInput = {
  moduleId: pandas.id,
  name: "  Pandas: limpieza de datos ",
  description: "",
  startTime: "18:00",
  endTime: "20:00",
};

test("createClasses creates the same class for both groups, each on its own date", async () => {
  const { service } = build();

  const created = await service.createClasses({
    ...baseInput,
    sessions: [
      { groupId: cdd1.id, classDate: "2026-10-05" },
      { groupId: cdd2.id, classDate: "2026-10-06" },
    ],
  });

  assert.equal(created.length, 2);
  assert.deepEqual(created.map((item) => [item.groupId, item.classDate]), [[cdd1.id, "2026-10-05"], [cdd2.id, "2026-10-06"]]);
  assert.equal(created[0]?.name, "Pandas: limpieza de datos");
  assert.equal(created[0]?.description, null);
  assert.equal(created[0]?.startTime, "18:00:00");
  assert.equal(created[0]?.endTime, "20:00:00");
});

test("createClasses creates nothing if one of the sessions is invalid", async () => {
  const { service, repository } = build();

  await assert.rejects(
    service.createClasses({
      ...baseInput,
      sessions: [
        { groupId: cdd1.id, classDate: "2026-10-05" },
        { groupId: cdd2.id, classDate: "2026-02-30" },
      ],
    }),
    ClassInputError,
  );
  assert.equal(repository.items.size, 0);
});

test("createClasses validates dates, times, name and sessions", async () => {
  const { service } = build();
  const session = [{ groupId: cdd1.id, classDate: "2026-10-05" }];

  await assert.rejects(service.createClasses({ ...baseInput, sessions: [] }), ClassInputError);
  await assert.rejects(service.createClasses({ ...baseInput, sessions: [{ groupId: cdd1.id, classDate: "05/10/2026" }] }), ClassInputError);
  await assert.rejects(service.createClasses({ ...baseInput, startTime: "25:00", sessions: session }), ClassInputError);
  await assert.rejects(service.createClasses({ ...baseInput, startTime: "20:00", endTime: "18:00", sessions: session }), ClassInputError);
  await assert.rejects(service.createClasses({ ...baseInput, name: "   ", sessions: session }), ClassInputError);
  await assert.rejects(service.createClasses({ ...baseInput, name: "x".repeat(201), sessions: session }), ClassInputError);
});

test("start and end times are optional", async () => {
  const { service } = build();

  const [created] = await service.createClasses({
    ...baseInput,
    startTime: "",
    endTime: undefined,
    sessions: [{ groupId: cdd1.id, classDate: "2026-10-05" }],
  });

  assert.equal(created?.startTime, null);
  assert.equal(created?.endTime, null);
});

test("createClasses rejects a module or group that does not exist", async () => {
  const { service } = build();

  await assert.rejects(
    service.createClasses({ ...baseInput, moduleId: "999", sessions: [{ groupId: cdd1.id, classDate: "2026-10-05" }] }),
    ClassModuleNotFoundError,
  );
  await assert.rejects(
    service.createClasses({ ...baseInput, sessions: [{ groupId: "999", classDate: "2026-10-05" }] }),
    ClassGroupNotFoundError,
  );
});

test("updateClass changes a class and rejects one that does not exist", async () => {
  const { service } = build();
  const [created] = await service.createClasses({ ...baseInput, sessions: [{ groupId: cdd1.id, classDate: "2026-10-05" }] });
  assert.ok(created);

  const updated = await service.updateClass(created.id, {
    ...baseInput,
    groupId: cdd2.id,
    name: "Pandas: agregaciones",
    classDate: "2026-10-07",
  });

  assert.equal(updated.groupId, cdd2.id);
  assert.equal(updated.name, "Pandas: agregaciones");
  assert.equal(updated.classDate, "2026-10-07");

  await assert.rejects(
    service.updateClass("999", { ...baseInput, groupId: cdd1.id, classDate: "2026-10-07" }),
    ClassNotFoundError,
  );
});

test("deleteClass removes a class and rejects one that does not exist", async () => {
  const { service, repository } = build();
  const [created] = await service.createClasses({ ...baseInput, sessions: [{ groupId: cdd1.id, classDate: "2026-10-05" }] });
  assert.ok(created);

  await service.deleteClass(created.id);

  assert.equal(repository.items.size, 0);
  await assert.rejects(service.deleteClass(created.id), ClassNotFoundError);
});
