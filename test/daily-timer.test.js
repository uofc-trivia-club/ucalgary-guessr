import test from "node:test";
import assert from "node:assert/strict";
import { createActiveTimer } from "../public/js/dailyTimer.js";

test("daily time pauses away from the page and survives return and reload", () => {
  let now = 0;
  const entries = new Map();
  const storage = { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
  const timer = createActiveTimer({ now: () => now, storage });
  timer.start("daily-1");
  timer.resume();
  now = 2000;
  assert.equal(timer.pause(), 2000);
  now = 60000;
  assert.equal(timer.elapsed(), 2000);
  timer.resume();
  now = 63000;
  assert.equal(timer.pause(), 5000);
  const restored = createActiveTimer({ now: () => now, storage });
  restored.start("daily-1");
  assert.equal(restored.elapsed(), 5000);
  restored.start("daily-2");
  assert.equal(restored.elapsed(), 0);
});

test("blocked browser storage does not prevent the daily timer from running", () => {
  let now = 0;
  const timer = createActiveTimer({ now: () => now, storage: {
    getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); }
  } });
  timer.start("daily");
  timer.resume();
  now = 1500;
  assert.equal(timer.pause(), 1500);
});
