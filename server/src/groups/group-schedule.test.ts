import assert from "node:assert/strict";
import test from "node:test";

import { CDD1_GROUP_NAME, CDD2_GROUP_NAME, getGroupNameForDate, getGroupNameForWeekday } from "./group-schedule.js";

test("the group names match the rows in user_groups", () => {
  assert.equal(CDD1_GROUP_NAME, "Tecnolochicas PRO - CDD1 2026");
  assert.equal(CDD2_GROUP_NAME, "Tecnolochicas PRO - CDD2 2026");
});

test("Monday maps to CDD1", () => {
  assert.equal(getGroupNameForWeekday(1), CDD1_GROUP_NAME);
});

test("Wednesday maps to CDD1", () => {
  assert.equal(getGroupNameForWeekday(3), CDD1_GROUP_NAME);
});

test("Tuesday maps to CDD2", () => {
  assert.equal(getGroupNameForWeekday(2), CDD2_GROUP_NAME);
});

test("Thursday maps to CDD2", () => {
  assert.equal(getGroupNameForWeekday(4), CDD2_GROUP_NAME);
});

test("Friday, Saturday, and Sunday have no automatic group", () => {
  assert.equal(getGroupNameForWeekday(5), null);
  assert.equal(getGroupNameForWeekday(6), null);
  assert.equal(getGroupNameForWeekday(0), null);
});

test("getGroupNameForDate reads the weekday from the injected date, never from the system clock", () => {
  const monday = new Date(2026, 0, 5, 12, 0, 0);
  assert.equal(monday.getDay(), 1, "test fixture date must actually be a Monday");
  assert.equal(getGroupNameForDate(monday), CDD1_GROUP_NAME);

  const friday = new Date(2026, 0, 9, 12, 0, 0);
  assert.equal(friday.getDay(), 5, "test fixture date must actually be a Friday");
  assert.equal(getGroupNameForDate(friday), null);
});
