import assert from 'node:assert/strict';
import test from 'node:test';

import { advanceWithPilot, createPilot } from '../src/autopilot.js';
import { createGame, WORLD } from '../src/game-core.js';

function runPilotToFinish() {
  const game = createGame({ seed: 20260515 });
  const pilot = createPilot();
  let snapshot = game.getState();

  for (let step = 0; step < 520; step += 1) {
    snapshot = advanceWithPilot(game, pilot, 80).snapshot;
    if (snapshot.mode === 'finished') {
      return snapshot;
    }
    assert.notEqual(snapshot.mode, 'crashed', snapshot.lastCrashReason ?? 'unexpected crash');
  }

  return snapshot;
}

test('title state exposes an untouched arena', () => {
  const game = createGame({ seed: 20260515 });
  const snapshot = game.getState();

  assert.equal(snapshot.mode, 'title');
  assert.equal(snapshot.orbsCollectedCount, 0);
  assert.equal(snapshot.clustersClearedCount, 0);
  assert.equal(snapshot.player.length, 10);
});

test('autopilot clears the full timed-boost route', () => {
  const snapshot = runPilotToFinish();

  assert.equal(snapshot.mode, 'finished');
  assert.equal(snapshot.clustersClearedCount, snapshot.totalClusters);
  assert.equal(snapshot.orbsCollectedCount, snapshot.totalOrbs);
  assert(snapshot.boost.capturedWindows >= 2);
  assert(snapshot.boost.useMs >= 1200);
  assert(snapshot.score >= 3600);
});

test('pause freezes elapsed time and head position', () => {
  const game = createGame({ seed: 20260515 });
  const pilot = createPilot();
  let snapshot = game.getState();

  while (snapshot.mode !== 'running' || snapshot.clustersClearedCount < 2) {
    snapshot = advanceWithPilot(game, pilot, 80).snapshot;
    assert.notEqual(snapshot.mode, 'crashed', snapshot.lastCrashReason ?? 'unexpected crash');
  }

  game.togglePause();
  const before = game.getState();
  game.advance(1200);
  const after = game.getState();

  assert.equal(before.elapsedMs, after.elapsedMs);
  assert.equal(before.player.x, after.player.x);
  assert.equal(before.player.y, after.player.y);
});

test('walls still end the run', () => {
  const game = createGame({ seed: 20260515 });
  game.startOrRestart();
  game.setPointerTarget(WORLD.arena.left - 80, WORLD.arena.top - 80);
  game.setBoostPressed(true);

  let snapshot = game.getState();
  for (let step = 0; step < 200; step += 1) {
    snapshot = game.advance(80);
    if (snapshot.mode === 'crashed') {
      break;
    }
  }

  assert.equal(snapshot.mode, 'crashed');
  assert.match(snapshot.lastCrashReason, /arena wall/i);
});
