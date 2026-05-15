import test from 'node:test';
import assert from 'node:assert/strict';

import { advanceWithPilot, createPilot } from '../src/autopilot.js';
import { createGame } from '../src/game-core.js';

test('pilot clears the deterministic course', () => {
  const game = createGame({ seed: 20260513 });
  const pilot = createPilot();

  let snapshot = game.getState();
  for (let step = 0; step < 720; step += 1) {
    const result = advanceWithPilot(game, pilot, 60);
    snapshot = result.snapshot;
    if (snapshot.mode === 'finished') {
      break;
    }
  }

  assert.equal(snapshot.mode, 'finished');
  assert.equal(snapshot.clearedCount, snapshot.totalObstacles);
  assert(snapshot.ringsCollectedCount >= 6, `expected at least 6 rings, got ${snapshot.ringsCollectedCount}`);
  assert(snapshot.score >= 1800, `expected score >= 1800, got ${snapshot.score}`);
});

test('pause freezes time and distance', () => {
  const game = createGame({ seed: 20260513 });
  const pilot = createPilot();

  let snapshot = game.getState();
  for (let step = 0; step < 8; step += 1) {
    snapshot = advanceWithPilot(game, pilot, 60).snapshot;
  }

  const beforePause = snapshot;

  game.togglePause();
  game.advance(900);
  const duringPause = game.getState();

  assert.equal(duringPause.mode, 'paused');
  assert.equal(duringPause.elapsedMs, beforePause.elapsedMs);
  assert.equal(duringPause.distance, beforePause.distance);

  game.togglePause();
  game.advance(300);
  const afterResume = game.getState();
  assert.equal(afterResume.mode, 'running');
  assert(afterResume.elapsedMs > beforePause.elapsedMs);
});

test('no-input run crashes and restart resets the route', () => {
  const game = createGame({ seed: 20260513 });
  game.startOrRestart();

  let snapshot = game.getState();
  for (let step = 0; step < 200; step += 1) {
    snapshot = game.advance(100);
    if (snapshot.mode === 'crashed') {
      break;
    }
  }

  assert.equal(snapshot.mode, 'crashed');
  assert.match(snapshot.lastCrashReason, /clipped/);

  const restarted = game.startOrRestart();
  assert.equal(restarted.mode, 'running');
  assert.equal(restarted.distance, 0);
  assert.equal(restarted.score, 0);
  assert.equal(restarted.clearedCount, 0);
});
