export const FIXED_STEP_MS = 1000 / 60;

export const WORLD = {
  width: 960,
  height: 540,
  groundY: 444,
  playerX: 188,
  playerWidth: 56,
  playerHeight: 60,
  finishDistance: 4320,
};

const BASE_SPEED = 294;
const GRAVITY = 1620;
const JUMP_VELOCITY = -790;
const COYOTE_MS = 110;
const JUMP_BUFFER_MS = 140;

const OBSTACLE_DEFS = [
  {
    id: 'pulse-01',
    label: 'Warm-Up Step',
    x: 640,
    jumpCue: 244,
    ring: { x: 688, y: 288, radius: 15 },
    segments: [{ offsetX: 0, width: 82, minHeight: 44, maxHeight: 126, cycleMs: 1120, phaseMs: 110 }],
  },
  {
    id: 'pulse-02',
    label: 'Split Lift',
    x: 1060,
    jumpCue: 252,
    ring: { x: 1138, y: 258, radius: 15 },
    segments: [
      { offsetX: 0, width: 34, minHeight: 16, maxHeight: 48, cycleMs: 960, phaseMs: 80 },
      { offsetX: 58, width: 28, minHeight: 28, maxHeight: 68, cycleMs: 1340, phaseMs: 420 },
    ],
  },
  {
    id: 'pulse-03',
    label: 'Skyline Gate',
    x: 1500,
    jumpCue: 264,
    ring: { x: 1542, y: 238, radius: 16 },
    segments: [{ offsetX: 0, width: 92, minHeight: 54, maxHeight: 140, cycleMs: 1240, phaseMs: 280 }],
  },
  {
    id: 'pulse-04',
    label: 'Zipper Pair',
    x: 1940,
    jumpCue: 258,
    ring: { x: 2010, y: 272, radius: 15 },
    segments: [
      { offsetX: 0, width: 44, minHeight: 42, maxHeight: 118, cycleMs: 820, phaseMs: 180 },
      { offsetX: 70, width: 44, minHeight: 36, maxHeight: 112, cycleMs: 820, phaseMs: 560 },
    ],
  },
  {
    id: 'pulse-05',
    label: 'Metro Ladder',
    x: 2350,
    jumpCue: 272,
    ring: { x: 2450, y: 228, radius: 16 },
    segments: [
      { offsetX: 0, width: 28, minHeight: 34, maxHeight: 88, cycleMs: 980, phaseMs: 220 },
      { offsetX: 42, width: 28, minHeight: 22, maxHeight: 60, cycleMs: 980, phaseMs: 500 },
      { offsetX: 84, width: 28, minHeight: 42, maxHeight: 104, cycleMs: 980, phaseMs: 820 },
    ],
  },
  {
    id: 'pulse-06',
    label: 'Breaker Wall',
    x: 2805,
    jumpCue: 282,
    ring: { x: 2858, y: 216, radius: 16 },
    segments: [{ offsetX: 0, width: 72, minHeight: 40, maxHeight: 118, cycleMs: 930, phaseMs: 360 }],
  },
  {
    id: 'pulse-07',
    label: 'Twin Surge',
    x: 3260,
    jumpCue: 286,
    ring: { x: 3330, y: 260, radius: 15 },
    segments: [
      { offsetX: 0, width: 42, minHeight: 40, maxHeight: 104, cycleMs: 880, phaseMs: 140 },
      { offsetX: 68, width: 34, minHeight: 14, maxHeight: 72, cycleMs: 1180, phaseMs: 560 },
    ],
  },
  {
    id: 'pulse-08',
    label: 'Final Cascade',
    x: 3690,
    jumpCue: 292,
    ring: { x: 3792, y: 236, radius: 16 },
    segments: [
      { offsetX: 0, width: 34, minHeight: 32, maxHeight: 84, cycleMs: 860, phaseMs: 90 },
      { offsetX: 46, width: 34, minHeight: 46, maxHeight: 110, cycleMs: 1180, phaseMs: 420 },
      { offsetX: 92, width: 34, minHeight: 20, maxHeight: 76, cycleMs: 860, phaseMs: 710 },
    ],
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function triangleWave(elapsedMs, cycleMs, phaseMs = 0) {
  const normalized = ((elapsedMs + phaseMs) % cycleMs + cycleMs) % cycleMs;
  const progress = normalized / cycleMs;
  return progress < 0.5 ? progress * 2 : 2 - progress * 2;
}

function resolveSegmentHeight(segment, elapsedMs, obstacleScreenX) {
  const rawPulse = triangleWave(elapsedMs, segment.cycleMs, segment.phaseMs);
  const safePulse =
    obstacleScreenX <= 220 ? Math.min(rawPulse, 0.25) : obstacleScreenX <= 300 ? Math.min(rawPulse, 0.38) : rawPulse;
  const height = segment.minHeight + (segment.maxHeight - segment.minHeight) * safePulse;
  return {
    pulse: safePulse,
    height,
  };
}

function createInitialState(seed) {
  return {
    seed,
    mode: 'title',
    elapsedMs: 0,
    distance: 0,
    score: 0,
    finishBonus: 0,
    clearedCount: 0,
    totalObstacles: OBSTACLE_DEFS.length,
    ringsCollectedCount: 0,
    totalRings: OBSTACLE_DEFS.length,
    combo: 0,
    peakCombo: 0,
    lastCrashReason: null,
    message: 'Pulse lanes reset every cycle. Time jumps to each opening.',
    player: {
      x: WORLD.playerX,
      y: WORLD.groundY - WORLD.playerHeight,
      width: WORLD.playerWidth,
      height: WORLD.playerHeight,
      vy: 0,
      grounded: true,
      coyoteMs: COYOTE_MS,
      jumpBufferMs: 0,
      jumps: 0,
    },
    clearedObstacleIds: [],
    collectedRingIds: [],
    flashMs: 0,
  };
}

function stateGroundTop() {
  return WORLD.groundY - WORLD.playerHeight;
}

function createSnapshot(state) {
  const visibleObstacles = OBSTACLE_DEFS.map((obstacle) => describeObstacle(state, obstacle))
    .filter((obstacle) => obstacle.screenX + obstacle.width >= -48 && obstacle.screenX <= WORLD.width + 96);

  const visibleRings = OBSTACLE_DEFS.map((obstacle) => describeRing(state, obstacle))
    .filter(Boolean)
    .filter((ring) => ring.screenX + ring.radius >= -32 && ring.screenX - ring.radius <= WORLD.width + 32);

  return {
    seed: state.seed,
    mode: state.mode,
    elapsedMs: Math.round(state.elapsedMs),
    distance: round(state.distance, 2),
    progress: round((state.distance / WORLD.finishDistance) * 100, 2),
    score: Math.round(state.score),
    finishBonus: Math.round(state.finishBonus),
    combo: state.combo,
    peakCombo: state.peakCombo,
    clearedCount: state.clearedCount,
    totalObstacles: state.totalObstacles,
    ringsCollectedCount: state.ringsCollectedCount,
    totalRings: state.totalRings,
    speed: round(currentSpeed(state)),
    message: state.message,
    lastCrashReason: state.lastCrashReason,
    pulseBeat: round(triangleWave(state.elapsedMs, 980, 140), 3),
    player: {
      x: round(state.player.x, 2),
      y: round(state.player.y, 2),
      width: state.player.width,
      height: state.player.height,
      vy: round(state.player.vy, 2),
      grounded: state.player.grounded,
      jumps: state.player.jumps,
      bottom: round(state.player.y + state.player.height, 2),
    },
    world: {
      width: WORLD.width,
      height: WORLD.height,
      groundY: WORLD.groundY,
      finishDistance: WORLD.finishDistance,
      coordinateSystem: 'origin top-left, x increases right, y increases down',
    },
    upcoming: visibleObstacles.slice(0, 4),
    rings: visibleRings.slice(0, 4),
  };
}

function currentSpeed(state) {
  const distanceBoost = Math.min(72, state.distance * 0.012);
  const pulseBoost = triangleWave(state.elapsedMs, 1600, 240) * 20;
  return BASE_SPEED + distanceBoost + pulseBoost;
}

function describeObstacle(state, obstacle) {
  const obstacleScreenX = obstacle.x - state.distance;
  const segmentStates = obstacle.segments.map((segment) => {
    const { pulse, height } = resolveSegmentHeight(segment, state.elapsedMs, obstacleScreenX);
    return {
      offsetX: segment.offsetX,
      width: segment.width,
      height: round(height, 2),
      top: round(WORLD.groundY - height, 2),
      pulse: round(pulse, 3),
    };
  });

  const width = obstacle.segments.reduce((maxWidth, segment) => Math.max(maxWidth, segment.offsetX + segment.width), 0);
  const maxHeight = Math.max(...segmentStates.map((segment) => segment.height));
  return {
    id: obstacle.id,
    label: obstacle.label,
    screenX: round(obstacle.x - state.distance, 2),
    width,
    jumpCue: obstacle.jumpCue,
    cleared: state.clearedObstacleIds.includes(obstacle.id),
    maxHeight: round(maxHeight, 2),
    segments: segmentStates,
  };
}

function describeRing(state, obstacle) {
  if (!obstacle.ring || state.collectedRingIds.includes(`${obstacle.id}-ring`)) {
    return null;
  }

  return {
    id: `${obstacle.id}-ring`,
    screenX: round(obstacle.ring.x - state.distance, 2),
    y: obstacle.ring.y,
    radius: obstacle.ring.radius,
  };
}

function queueJump(state) {
  state.player.jumpBufferMs = JUMP_BUFFER_MS;
}

function performJump(state) {
  state.player.vy = JUMP_VELOCITY;
  state.player.grounded = false;
  state.player.coyoteMs = 0;
  state.player.jumpBufferMs = 0;
  state.player.jumps += 1;
  state.flashMs = 90;
}

function attemptBufferedJump(state) {
  if (state.player.jumpBufferMs <= 0) {
    return;
  }

  if (state.player.grounded || state.player.coyoteMs > 0) {
    performJump(state);
  }
}

function resetForRun(state, nextMode = 'title') {
  const seed = state.seed;
  const initial = createInitialState(seed);
  initial.mode = nextMode;
  initial.message =
    nextMode === 'running'
      ? 'Run live. Jump into the safe phase of each pulse lane.'
      : initial.message;
  return initial;
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function collectRingIfNeeded(state, obstacle) {
  if (!obstacle.ring) {
    return;
  }

    const ringId = `${obstacle.id}-ring`;
  if (state.collectedRingIds.includes(ringId)) {
    return;
  }

  const ringScreenX = obstacle.ring.x - state.distance;
  const playerCenterX = state.player.x + state.player.width / 2;
  const playerCenterY = state.player.y + state.player.height / 2;
  const dx = playerCenterX - ringScreenX;
  const dy = playerCenterY - obstacle.ring.y;
  const radius = obstacle.ring.radius + 22;

  if (dx * dx + dy * dy <= radius * radius) {
    state.collectedRingIds.push(ringId);
    state.ringsCollectedCount += 1;
    state.score += 120;
    state.message = `Captured pulse ring ${state.ringsCollectedCount}/${state.totalRings}.`;
  }
}

function clearObstacleIfNeeded(state, obstacle) {
  if (state.clearedObstacleIds.includes(obstacle.id)) {
    return;
  }

  const obstacleTail = obstacle.x + obstacle.segments.reduce((maxWidth, segment) => Math.max(maxWidth, segment.offsetX + segment.width), 0);
  if (obstacleTail - state.distance < state.player.x - 20) {
    state.clearedObstacleIds.push(obstacle.id);
    state.clearedCount += 1;
    state.combo += 1;
    state.peakCombo = Math.max(state.peakCombo, state.combo);
    state.score += 90 + state.combo * 14;
    state.message = `${obstacle.label} cleared. Combo ${state.combo}.`;
  }
}

function handleObstacleCollision(state, obstacle) {
  if (state.clearedObstacleIds.includes(obstacle.id)) {
    return false;
  }

  const playerRect = {
    x: state.player.x + 4,
    y: state.player.y + 4,
    width: state.player.width - 8,
    height: state.player.height - 8,
  };

  for (const segment of obstacle.segments) {
    const obstacleScreenX = obstacle.x - state.distance;
    const { height } = resolveSegmentHeight(segment, state.elapsedMs, obstacleScreenX);
    const rect = {
      x: obstacleScreenX + segment.offsetX,
      y: WORLD.groundY - height,
      width: segment.width,
      height,
    };
    if (rectsIntersect(playerRect, rect)) {
      state.mode = 'crashed';
      state.combo = 0;
      state.lastCrashReason = `${obstacle.label} clipped the runner.`;
      state.message = state.lastCrashReason;
      return true;
    }
  }

  return false;
}

function finishRun(state) {
  state.mode = 'finished';
  state.finishBonus = Math.max(260, 1320 - Math.round(state.elapsedMs / 7)) + state.ringsCollectedCount * 30 + state.peakCombo * 18;
  state.score += state.finishBonus;
  state.message = `Finish surge complete in ${(state.elapsedMs / 1000).toFixed(2)}s.`;
}

function applySimulationStep(state, stepMs) {
  const dtSeconds = stepMs / 1000;
  const speed = currentSpeed(state);
  state.elapsedMs += stepMs;
  state.flashMs = Math.max(0, state.flashMs - stepMs);

  state.player.jumpBufferMs = Math.max(0, state.player.jumpBufferMs - stepMs);
  state.player.coyoteMs = state.player.grounded ? COYOTE_MS : Math.max(0, state.player.coyoteMs - stepMs);
  attemptBufferedJump(state);

  state.distance += speed * dtSeconds;
  state.player.vy += GRAVITY * dtSeconds;
  state.player.y += state.player.vy * dtSeconds;

  const groundTop = stateGroundTop();
  if (state.player.y >= groundTop) {
    state.player.y = groundTop;
    state.player.vy = 0;
    state.player.grounded = true;
    state.player.coyoteMs = COYOTE_MS;
  } else {
    state.player.grounded = false;
  }

  for (const obstacle of OBSTACLE_DEFS) {
    collectRingIfNeeded(state, obstacle);
    if (handleObstacleCollision(state, obstacle)) {
      return;
    }
    clearObstacleIfNeeded(state, obstacle);
  }

  const distanceScore = Math.floor(state.distance * 0.16);
  state.score = Math.max(state.score, distanceScore + state.ringsCollectedCount * 120 + state.clearedCount * 90 + state.peakCombo * 20);

  if (state.distance >= WORLD.finishDistance) {
    finishRun(state);
  }
}

export function renderGameToText(snapshot) {
  const view = snapshot.upcoming.map((obstacle) => ({
    id: obstacle.id,
    label: obstacle.label,
    screenX: obstacle.screenX,
    width: obstacle.width,
    jumpCue: obstacle.jumpCue,
    maxHeight: obstacle.maxHeight,
    cleared: obstacle.cleared,
    segments: obstacle.segments.map((segment) => ({
      x: round(obstacle.screenX + segment.offsetX, 2),
      width: segment.width,
      top: segment.top,
      height: segment.height,
    })),
  }));

  return JSON.stringify(
    {
      mode: snapshot.mode,
      score: snapshot.score,
      progress: snapshot.progress,
      elapsedMs: snapshot.elapsedMs,
      speed: snapshot.speed,
      message: snapshot.message,
      lastCrashReason: snapshot.lastCrashReason,
      clearedCount: snapshot.clearedCount,
      totalObstacles: snapshot.totalObstacles,
      ringsCollectedCount: snapshot.ringsCollectedCount,
      totalRings: snapshot.totalRings,
      world: snapshot.world,
      player: snapshot.player,
      upcoming: view,
      rings: snapshot.rings,
      counters: {
        cleared: `${snapshot.clearedCount}/${snapshot.totalObstacles}`,
        rings: `${snapshot.ringsCollectedCount}/${snapshot.totalRings}`,
        combo: snapshot.combo,
        peakCombo: snapshot.peakCombo,
      },
    },
    null,
    2
  );
}

export function createGame({ seed = 20260513 } = {}) {
  let state = createInitialState(seed);
  let accumulatorMs = 0;

  function advance(ms) {
    if (state.mode === 'title' || state.mode === 'paused' || state.mode === 'finished' || state.mode === 'crashed') {
      return createSnapshot(state);
    }

    accumulatorMs += ms;
    while (accumulatorMs >= FIXED_STEP_MS && state.mode === 'running') {
      applySimulationStep(state, FIXED_STEP_MS);
      accumulatorMs -= FIXED_STEP_MS;
    }
    return createSnapshot(state);
  }

  function getState() {
    return createSnapshot(state);
  }

  return {
    getState,
    advance,
    queueJump() {
      if (state.mode === 'title') {
        state = resetForRun(state, 'running');
      }
      if (state.mode === 'crashed' || state.mode === 'finished') {
        state = resetForRun(state, 'running');
      }
      if (state.mode !== 'running') {
        return createSnapshot(state);
      }
      queueJump(state);
      attemptBufferedJump(state);
      return createSnapshot(state);
    },
    startOrRestart() {
      if (state.mode === 'paused') {
        state.mode = 'running';
        state.message = 'Run resumed.';
        return createSnapshot(state);
      }
      if (state.mode === 'running') {
        return createSnapshot(state);
      }
      state = resetForRun(state, 'running');
      accumulatorMs = 0;
      return createSnapshot(state);
    },
    togglePause() {
      if (state.mode === 'running') {
        state.mode = 'paused';
        state.message = 'Pulse lanes paused.';
      } else if (state.mode === 'paused') {
        state.mode = 'running';
        state.message = 'Run resumed.';
      }
      return createSnapshot(state);
    },
    resetToTitle() {
      state = resetForRun(state, 'title');
      accumulatorMs = 0;
      return createSnapshot(state);
    },
  };
}
