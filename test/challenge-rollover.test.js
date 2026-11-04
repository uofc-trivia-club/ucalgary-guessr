import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { createChallengeRouter } from '../server/routes/challengeRouter.js';

for (const mode of ['daily', 'weekly']) {
  test(`${mode} rejects an old-tab guess after another tab loads the new period`, async t => {
    let date = '2026-10-18';
    const session = {};
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.session = session; next(); });
    app.use(createChallengeRouter({
      mode, getPeriod: () => ({ date }),
      getChallenge: async () => ({ image_id: date, image_path: '/assets/photos/admins/general/AD-atrium.jpeg', answer_latitude: 51.079, answer_longitude: -114.129 }),
      getScoreForUser: async () => null, getRankForUser: async () => null,
      createScore: async () => {}, getLeaderboard: async () => [],
    }));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = 'http://127.0.0.1:' + server.address().port;
    await fetch(base);
    date = '2026-10-25';
    await fetch(base); // The other tab refreshes the shared session's attempt.
    const stale = await fetch(base + '/guess', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ guess: { latitude: 51.079, longitude: -114.129 }, elapsedMs: 0, challengeDate: '2026-10-18' }) });
    assert.equal(stale.status, 409);
    assert.equal(session[mode + 'Attempt'].revealed, false);
    const current = await fetch(base + '/guess', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ guess: { latitude: 51.079, longitude: -114.129 }, elapsedMs: 0, challengeDate: '2026-10-25' }) });
    assert.equal(current.status, 200);
  });
}
