import assert from "node:assert/strict";
import test from "node:test";

import { getGroupNameForDate, getGroupNameForWeekday } from "./group-schedule.js";

test("Monday maps to Grupo 1", () => {
  assert.equal(getGroupNameForWeekday(1), "Grupo 1");
});

test("Wednesday maps to Grupo 1", () => {
  assert.equal(getGroupNameForWeekday(3), "Grupo 1");
});

test("Tuesday maps to Grupo 2", () => {
  assert.equal(getGroupNameForWeekday(2), "Grupo 2");
});

test("Thursday maps to Grupo 2", () => {
  assert.equal(getGroupNameForWeekday(4), "Grupo 2");
});

test("Friday, Saturday, and Sunday have no automatic group", () => {
  assert.equal(getGroupNameForWeekday(5), null);
  assert.equal(getGroupNameForWeekday(6), null);
  assert.equal(getGroupNameForWeekday(0), null);
});

test("getGroupNameForDate reads the weekday from the injected date, never from the system clock", () => {
  const monday = new Date(2026, 0, 5, 12, 0, 0);
  assert.equal(monday.getDay(), 1, "test fixture date must actually be a Monday");
  assert.equal(getGroupNameForDate(monday), "Grupo 1");

  const friday = new Date(2026, 0, 9, 12, 0, 0);
  assert.equal(friday.getDay(), 5, "test fixture date must actually be a Friday");
  assert.equal(getGroupNameForDate(friday), null);
});
