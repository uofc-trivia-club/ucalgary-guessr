import test from "node:test";
import assert from "node:assert/strict";
import { getMountainDate, getWeeklyPeriod } from "../server/utils/challengePeriods.js";

test("Daily rolls over at Mountain midnight in summer and winter", () => {
  for (const [instant, want] of [
    ["2026-10-22T05:59:59.999Z", "2026-10-21"], ["2026-10-22T06:00:00Z", "2026-10-22"],
    ["2026-12-02T06:59:59.999Z", "2026-12-01"], ["2026-12-02T07:00:00Z", "2026-12-02"],
  ]) assert.equal(getMountainDate(new Date(instant)), want);
});

test("Weekly changes on Sunday Mountain midnight, including daylight-saving and year boundaries", () => {
  for (const [instant, date, endDate] of [
    ["2026-10-25T05:59:59.999Z", "2026-10-18", "2026-10-25"],
    ["2026-10-25T06:00:00Z", "2026-10-25", "2026-11-01"],
    ["2026-11-01T06:00:00Z", "2026-11-01", "2026-11-08"],
    ["2026-11-08T06:59:59.999Z", "2026-11-01", "2026-11-08"],
    ["2026-11-08T07:00:00Z", "2026-11-08", "2026-11-15"],
    ["2026-03-08T06:59:59.999Z", "2026-03-01", "2026-03-08"],
    ["2026-03-08T07:00:00Z", "2026-03-08", "2026-03-15"],
    ["2026-03-15T06:00:00Z", "2026-03-15", "2026-03-22"],
    ["2027-01-01T12:00:00Z", "2026-12-27", "2027-01-03"],
  ]) assert.deepEqual(getWeeklyPeriod(new Date(instant)), { date, endDate }, instant);
});
