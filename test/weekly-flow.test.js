import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

test("Weekly has independent attempts, active time, auth carryover, and a persistent ranked leaderboard", async t => {
  process.env.GUESSR_DB_PATH = ":memory:";
  process.env.EMAIL_MODE = "console";
  process.env.SESSION_SECRET = "weekly-test-secret";
  process.env.NODE_ENV = "test";
  const { default: app } = await import("../app.js");
  const db = (await import("../server/config/db.js")).default;
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const base = 'http://127.0.0.1:' + server.address().port;
  let cookie = "";
  async function request(route, method = "GET", body) {
    const res = await fetch(base + '/api' + route, { method,
      headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
    return { status: res.status, data: await res.json() };
  }
  assert.equal((await fetch(base + '/weekly')).status, 200);
  const weekly = await request('/weekly');
  assert.equal(weekly.status, 200);
  assert.equal(new Date(weekly.data.date + 'T00:00:00Z').getUTCDay(), 0);
  assert.equal(new Date(weekly.data.endDate + 'T00:00:00Z') - new Date(weekly.data.date + 'T00:00:00Z'), 604800000);
  assert.deepEqual((await request('/weekly')).data.image, weekly.data.image);
  await request('/daily');
  const guess = { latitude: 51.079, longitude: -114.129 };
  assert.equal((await request('/weekly/guess', 'POST', { guess, elapsedMs: -1 })).status, 400);
  const guest = await request('/weekly/guess', 'POST', { guess, elapsedMs: 0 });
  assert.equal(guest.status, 200);
  assert.equal(guest.data.saved, false);
  assert.equal(guest.data.elapsedMs, 0);
  assert.equal((await request('/daily')).data.completed, false);
  assert.equal((await request('/weekly')).data.completed, true);
  await request('/auth/register', 'POST', { username: 'weekly_guest', email: 'weekly-guest@test.org', password: 'test-password-only' });
  assert.equal((await request('/weekly/guess', 'POST', { guess })).status, 409);
  assert.equal((await request('/weekly/leaderboard')).data.entries.length, 0);
  cookie = '';
  await request('/auth/register', 'POST', { username: 'weekly_ranked', email: 'weekly-ranked@test.org', password: 'test-password-only' });
  await request('/weekly');
  const submissions = await Promise.all([request('/weekly/guess', 'POST', { guess, elapsedMs: 0 }), request('/weekly/guess', 'POST', { guess, elapsedMs: 0 })]);
  assert.deepEqual(submissions.map(item => item.status).sort(), [200, 409]);
  const ranked = submissions.find(item => item.status === 200).data;
  assert.equal(ranked.saved, true);
  assert.equal(ranked.elapsedMs, 0);
  assert.equal((await request('/weekly/leaderboard')).data.entries[0].username, 'weekly_ranked');
  assert.equal((await request('/daily/leaderboard')).data.entries.length, 0);
  await request('/auth/logout', 'POST');
  await request('/auth/login', 'POST', { identifier: 'weekly_ranked', password: 'test-password-only' });
  const restored = (await request('/weekly')).data;
  assert.equal(restored.completed, true);
  assert.deepEqual(restored.result.answer, ranked.answer);
  assert.equal(restored.elapsedMs, 0);
  assert.equal((await request('/daily')).data.completed, false);
});
