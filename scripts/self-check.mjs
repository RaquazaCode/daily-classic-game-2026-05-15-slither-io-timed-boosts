import assert from 'node:assert/strict';

import { advanceWithPilot, createPilot } from '../src/autopilot.js';
import { createGame, renderGameToText } from '../src/game-core.js';

const game = createGame({ seed: 20260513 });
const pilot = createPilot();

let snapshot = game.getState();
for (let step = 0; step < 720; step += 1) {
  const result = advanceWithPilot(game, pilot, 60);
  snapshot = result.snapshot;
  if (snapshot.mode === 'finished') {
    break;
  }
  assert.notEqual(snapshot.mode, 'crashed', snapshot.lastCrashReason ?? 'unexpected crash');
}

assert.equal(snapshot.mode, 'finished');
assert.equal(snapshot.clearedCount, snapshot.totalObstacles);
assert(snapshot.ringsCollectedCount >= 6, `expected at least 6 rings, got ${snapshot.ringsCollectedCount}`);
assert(snapshot.score >= 1800, `expected score >= 1800, got ${snapshot.score}`);

console.log(renderGameToText(snapshot));
console.log('self-check ok');
