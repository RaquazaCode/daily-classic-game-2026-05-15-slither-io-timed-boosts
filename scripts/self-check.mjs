import assert from 'node:assert/strict';

import { advanceWithPilot, createPilot } from '../src/autopilot.js';
import { createGame, renderGameToText } from '../src/game-core.js';

const game = createGame({ seed: 20260515 });
const pilot = createPilot();

let snapshot = game.getState();
let pauseProved = false;

for (let step = 0; step < 520; step += 1) {
  const result = advanceWithPilot(game, pilot, 80);
  snapshot = result.snapshot;

  if (!pauseProved && snapshot.mode === 'running' && snapshot.clustersClearedCount >= 3) {
    game.togglePause();
    const before = game.getState();
    game.advance(1000);
    const after = game.getState();
    assert.equal(before.elapsedMs, after.elapsedMs);
    assert.equal(before.player.x, after.player.x);
    assert.equal(before.player.y, after.player.y);
    game.togglePause();
    pauseProved = true;
  }

  if (snapshot.mode === 'finished') {
    break;
  }

  assert.notEqual(snapshot.mode, 'crashed', snapshot.lastCrashReason ?? 'unexpected crash');
}

assert.equal(snapshot.mode, 'finished');
assert.equal(snapshot.clustersClearedCount, snapshot.totalClusters);
assert(snapshot.boost.capturedWindows >= 2, `expected at least 2 pulse bonuses, got ${snapshot.boost.capturedWindows}`);
assert(snapshot.boost.useMs >= 1200, `expected boost usage >= 1200ms, got ${snapshot.boost.useMs}`);
assert(snapshot.player.length >= 30, `expected snake length >= 30, got ${snapshot.player.length}`);
assert(snapshot.score >= 3600, `expected score >= 3600, got ${snapshot.score}`);
assert(pauseProved, 'expected pause proof to run');

console.log(renderGameToText(snapshot));
console.log('self-check ok');
