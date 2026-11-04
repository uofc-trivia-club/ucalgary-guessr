import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import net from "node:net";
import Database from "better-sqlite3";
import { once } from "node:events";

const root = fileURLToPath(new URL("..", import.meta.url));

function openPort() {
  return new Promise((resolve) => {
    const socket = net.createServer();
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

test("daily guest reveal cannot become ranked after login; random images are session-bound", async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "guessr-test-"));
  let server;
  t.after(async () => {
    if (server && server.exitCode === null && server.signalCode === null) {
      const exited = once(server, "exit");
      server.kill();
      await exited;
    }
    assert.equal(path.dirname(temp), path.resolve(os.tmpdir()));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const dbPath = path.join(temp, "game.db");
  const db = new Database(dbPath);
  db.exec(fs.readFileSync(path.join(root, "server/db/schema.sql"), "utf8"));
  db.exec(fs.readFileSync(path.join(root, "server/db/seed.sql"), "utf8"));
  db.close();

  const port = await openPort();
  server = spawn(process.execPath, ["server/server.js"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), GUESSR_DB_PATH: dbPath,
      NODE_ENV: "test", VERCEL: "", EMAIL_MODE: "console", SESSION_SECRET: "test-secret" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stderr.on("data", (data) => { output += data; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(output || "Server startup timed out")), 8000);
    server.stdout.on("data", (data) => {
      if (String(data).includes("Server running")) { clearTimeout(timeout); resolve(); }
    });
    server.once("exit", () => { clearTimeout(timeout); reject(new Error(output || "Server exited")); });
  });

  let cookie = "";
  async function request(route, method = "GET", body) {
    const res = await fetch(`http://127.0.0.1:${port}/api${route}`, {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.headers.get("set-cookie")) cookie = res.headers.get("set-cookie").split(";")[0];
    return { status: res.status, data: await res.json() };
  }

  const daily = await request("/daily");
  assert.equal(daily.status, 200);
  assert.ok(Number.isFinite(daily.data.startedAt));
  const guess = { latitude: 51.079, longitude: -114.129 };
  assert.equal((await request("/daily/guess", "POST", { guess, elapsedMs: -1 })).status, 400);
  const guest = await request("/daily/guess", "POST", { guess, elapsedMs: 0 });
  assert.equal(guest.data.elapsedMs, 0, "Submitted active time excludes time away");
  assert.equal(guest.status, 200);
  assert.equal(guest.data.saved, false);
  assert.equal(daily.data.result, undefined, "Answers stay hidden until submission");
  const guestReload = await request("/daily");
  assert.equal(guestReload.data.elapsedMs, 0, "Active time survives completed-result reload");
  assert.deepEqual(guestReload.data.result.guess, guest.data.guess);
  assert.deepEqual(guestReload.data.result.answer, guest.data.answer);
  assert.equal(guestReload.data.result.distanceMetres, guest.data.distanceMetres);
  const signup = await request("/auth/register", "POST", {
    username: "test_player", email: "test@example.org", password: "correct-horse-battery",
  });
  assert.equal(signup.status, 201);
  const afterLogin = await request("/daily");
  assert.equal(afterLogin.data.completed, true);
  assert.equal(afterLogin.data.score, guest.data.score);
  assert.equal((await request("/daily/guess", "POST", guess)).status, 409);
  assert.equal((await request("/auth/logout", "POST")).status, 200);
  assert.equal((await request("/auth/login", "POST", {
    identifier: "test_player", password: "correct-horse-battery",
  })).status, 200);
  assert.equal((await request("/daily")).data.completed, true);

  cookie = "";
  assert.equal((await request("/auth/register", "POST", {
    username: "ranked_player", email: "ranked@example.org", password: "correct-horse-battery",
  })).status, 201);
  const timed = await request("/daily");
  assert.equal((await request("/daily")).data.startedAt, timed.data.startedAt);
  const submissions = await Promise.all([
    request("/daily/guess", "POST", { guess, elapsedMs: 0 }), request("/daily/guess", "POST", { guess, elapsedMs: 0 }),
  ]);
  assert.deepEqual(submissions.map(result => result.status).sort(), [200, 409],
    "Concurrent ranked submissions must return a conflict for the duplicate");
  const ranked = submissions.find(result => result.status === 200);
  assert.equal(ranked.status, 200);
  assert.equal(ranked.data.saved, true);
  assert.equal(ranked.data.elapsedMs, 0, "Ranked results also use active completion time");
  const board = await request("/daily/leaderboard");
  assert.equal(board.data.entries[0].elapsedMs, ranked.data.elapsedMs);
  cookie = "";
  await request("/auth/login", "POST", {
    identifier: "ranked_player", password: "correct-horse-battery",
  });
  const rankedReload = await request("/daily");
  assert.deepEqual(rankedReload.data.result.guess, ranked.data.guess, "Ranked results survive a new session");
  assert.deepEqual(rankedReload.data.result.answer, ranked.data.answer);
  assert.equal(rankedReload.data.result.distanceMetres, ranked.data.distanceMetres);
  assert.equal(rankedReload.data.result.score, ranked.data.score);
  assert.equal(rankedReload.data.elapsedMs, ranked.data.elapsedMs);

  const random = await request("/rounds/random");
  assert.equal(random.status, 200);
  assert.equal((await request(`/rounds/invalid/guess`, "POST", { imageId: random.data.images[0].id, ...guess })).status, 409);
  const valid = { imageId: random.data.images[0].id, ...guess };
  const duplicateRandom = await Promise.all([
    request(`/rounds/${random.data.roundId}/guess`, "POST", valid),
    request(`/rounds/${random.data.roundId}/guess`, "POST", valid),
  ]);
  assert.deepEqual(duplicateRandom.map(result => result.status).sort(), [200, 409]);
  assert.equal((await request(`/rounds/${random.data.roundId}/guess`, "POST", valid)).status, 409);

  const { buildings } = JSON.parse(fs.readFileSync(path.join(root, 'server/data/campus-buildings.json'), 'utf8'));
  const buildingForPhoto = imagePath => {
    const code = path.basename(imagePath).match(/^[A-Za-z]+/)[0].toUpperCase();
    if (code === 'SS') return 'Social Sciences';
    if (code === 'ST') return 'Science Theatres';
    return buildings.find(building => building.code === code)?.name;
  };
  const correctRound = await request("/rounds/random");
  for (const image of correctRound.data.images) {
    const buildingName = buildingForPhoto(image.imagePath);
    const scored = await request(`/rounds/${correctRound.data.roundId}/guess`, "POST", {
      imageId: image.id, guess: { type: "building", buildingName, latitude: 0, longitude: 0 },
    });
    assert.equal(scored.status, 200);
    assert.equal(scored.data.score, 5000, image.imagePath);
    assert.equal(scored.data.exactBuilding, true);
    assert.equal(scored.data.distanceMetres, 0);
  }

  cookie = "";
  const buildingDaily = await request("/daily");
  const correctDaily = await request("/daily/guess", "POST", { guess: {
    type: "building", buildingName: buildingForPhoto(buildingDaily.data.image.imagePath),
    latitude: 0, longitude: 0,
  } });
  assert.equal(correctDaily.status, 200);
  assert.equal(correctDaily.data.score, 5000);
  assert.equal(correctDaily.data.exactBuilding, true);
  assert.equal((await request("/daily")).data.result.exactBuilding, true);

  // Upgrade rows created before guess snapshots existed without fabricating a guess.
  const oldScores = new Database(dbPath);
  oldScores.prepare("UPDATE daily_scores SET result_json = NULL").run();
  oldScores.close();
  cookie = "";
  await request("/auth/login", "POST", {
    identifier: "ranked_player", password: "correct-horse-battery",
  });
  const legacy = await request("/daily");
  assert.equal(legacy.data.result.guess, null);
  assert.equal(legacy.data.result.distanceMetres, ranked.data.distanceMetres);
  assert.deepEqual(legacy.data.result.answer, ranked.data.answer);
  assert.equal(legacy.data.score, ranked.data.score);
});
