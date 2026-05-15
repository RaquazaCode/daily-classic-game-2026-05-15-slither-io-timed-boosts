export const FIXED_STEP_MS = 1000 / 60;

export const WORLD = {
  width: 960,
  height: 540,
  arena: {
    left: 88,
    top: 60,
    right: 872,
    bottom: 480,
  },
  start: {
    x: 158,
    y: 272,
  },
};

const PLAYER_RADIUS = 12;
const PLAYER_BASE_SPEED = 126;
const PLAYER_BOOST_SPEED = 198;
const PLAYER_TURN_RATE = Math.PI * 1.95;
const RIVAL_TURN_RATE = Math.PI * 1.5;
const MAX_BOOST = 100;
const BOOST_PERIOD_MS = 3600;
const BOOST_ACTIVE_MS = 1180;
const BOOST_RECHARGE_PER_SECOND = 92;
const BOOST_DRAIN_PER_SECOND = 68;
const ORB_RADIUS = 9;
const ORB_SCORE = 84;
const CLUSTER_CLEAR_BONUS = 160;
const ACTIVE_WINDOW_CLEAR_BONUS = 120;
const FINISH_BONUS_BASE = 320;
const PLAYER_SEGMENT_SPACING = 10;
const RIVAL_SEGMENT_SPACING = 11;
const EPSILON = 0.0001;

const CLUSTERS = [
  {
    id: 'north-west',
    label: 'Northwest Bloom',
    x: 228,
    y: 158,
    orbs: [
      { x: -24, y: 0 },
      { x: 0, y: -22 },
      { x: 24, y: 0 },
      { x: 0, y: 22 },
    ],
  },
  {
    id: 'north-spine',
    label: 'North Spine',
    x: 470,
    y: 118,
    orbs: [
      { x: -30, y: 2 },
      { x: 0, y: -24 },
      { x: 0, y: 24 },
      { x: 30, y: 2 },
    ],
  },
  {
    id: 'north-east',
    label: 'Northeast Arc',
    x: 706,
    y: 164,
    orbs: [
      { x: -24, y: -6 },
      { x: 0, y: -28 },
      { x: 24, y: -6 },
      { x: 0, y: 22 },
    ],
  },
  {
    id: 'east-drift',
    label: 'East Drift',
    x: 738,
    y: 340,
    orbs: [
      { x: -18, y: -24 },
      { x: 20, y: -8 },
      { x: 16, y: 24 },
      { x: -20, y: 12 },
    ],
  },
  {
    id: 'south-spine',
    label: 'South Spine',
    x: 488,
    y: 410,
    orbs: [
      { x: -32, y: 0 },
      { x: 0, y: -22 },
      { x: 0, y: 22 },
      { x: 32, y: 0 },
    ],
  },
  {
    id: 'south-west',
    label: 'Southwest Coil',
    x: 216,
    y: 354,
    orbs: [
      { x: -20, y: -18 },
      { x: 24, y: -8 },
      { x: 22, y: 24 },
      { x: -22, y: 20 },
    ],
  },
];

const RIVAL_DEFS = [
  {
    id: 'coral-circuit',
    label: 'Coral Circuit',
    color: '#f5675d',
    headColor: '#ffd9bf',
    speed: 112,
    segmentCount: 18,
    waypoints: [
      { x: 326, y: 170 },
      { x: 610, y: 154 },
      { x: 668, y: 262 },
      { x: 596, y: 388 },
      { x: 338, y: 400 },
      { x: 284, y: 264 },
    ],
  },
  {
    id: 'jade-switchback',
    label: 'Jade Switchback',
    color: '#4dd4b2',
    headColor: '#e8fff7',
    speed: 104,
    segmentCount: 16,
    waypoints: [
      { x: 640, y: 202 },
      { x: 694, y: 254 },
      { x: 626, y: 314 },
      { x: 516, y: 304 },
      { x: 462, y: 242 },
      { x: 546, y: 178 },
    ],
  },
  {
    id: 'gold-arc',
    label: 'Gold Arc',
    color: '#ffb45f',
    headColor: '#fff2cf',
    speed: 108,
    segmentCount: 17,
    waypoints: [
      { x: 262, y: 270 },
      { x: 340, y: 210 },
      { x: 468, y: 198 },
      { x: 534, y: 268 },
      { x: 466, y: 334 },
      { x: 320, y: 324 },
    ],
  },
];

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeAngle(angle) {
  let current = angle;
  while (current <= -Math.PI) {
    current += Math.PI * 2;
  }
  while (current > Math.PI) {
    current -= Math.PI * 2;
  }
  return current;
}

function rotateToward(current, target, maxStep) {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maxStep) {
    return target;
  }
  return current + Math.sign(delta) * maxStep;
}

function createSnake({ id, label, color, headColor, x, y, angle, speed, segmentCount, segmentSpacing, turnRate, waypoints }) {
  const segments = Array.from({ length: segmentCount }, (_, index) => ({
    x: x - Math.cos(angle) * index * segmentSpacing,
    y: y - Math.sin(angle) * index * segmentSpacing,
  }));

  return {
    id,
    label,
    color,
    headColor,
    speed,
    angle,
    segmentSpacing,
    turnRate,
    waypoints: waypoints ? waypoints.map((point) => ({ ...point })) : null,
    waypointIndex: 1,
    segments,
  };
}

function createPlayer() {
  return createSnake({
    id: 'player',
    label: 'Player',
    color: '#1ac3b3',
    headColor: '#f6fff6',
    x: WORLD.start.x,
    y: WORLD.start.y,
    angle: 0,
    speed: PLAYER_BASE_SPEED,
    segmentCount: 10,
    segmentSpacing: PLAYER_SEGMENT_SPACING,
    turnRate: PLAYER_TURN_RATE,
  });
}

function createRival(def) {
  const start = def.waypoints[0];
  const next = def.waypoints[1];
  const angle = Math.atan2(next.y - start.y, next.x - start.x);
  return createSnake({
    ...def,
    x: start.x,
    y: start.y,
    angle,
    segmentSpacing: RIVAL_SEGMENT_SPACING,
    turnRate: RIVAL_TURN_RATE,
  });
}

function createOrbs() {
  return CLUSTERS.flatMap((cluster) =>
    cluster.orbs.map((offset, index) => ({
      id: `${cluster.id}-orb-${index + 1}`,
      clusterId: cluster.id,
      x: cluster.x + offset.x,
      y: cluster.y + offset.y,
      collected: false,
    }))
  );
}

function getBoostPhase(elapsedMs) {
  const cycleElapsed = ((elapsedMs % BOOST_PERIOD_MS) + BOOST_PERIOD_MS) % BOOST_PERIOD_MS;
  const active = cycleElapsed < BOOST_ACTIVE_MS;
  return {
    active,
    cycleElapsed,
    pulseIndex: Math.floor(elapsedMs / BOOST_PERIOD_MS),
    progress: active
      ? clamp(cycleElapsed / BOOST_ACTIVE_MS, 0, 1)
      : clamp((cycleElapsed - BOOST_ACTIVE_MS) / (BOOST_PERIOD_MS - BOOST_ACTIVE_MS), 0, 1),
    msUntilPhaseChange: active ? BOOST_ACTIVE_MS - cycleElapsed : BOOST_PERIOD_MS - cycleElapsed,
  };
}

function createInitialState(seed) {
  return {
    seed,
    mode: 'title',
    elapsedMs: 0,
    score: 0,
    finishBonus: 0,
    combo: 0,
    peakCombo: 0,
    orbsCollectedCount: 0,
    totalOrbs: CLUSTERS.length * 4,
    clustersClearedCount: 0,
    totalClusters: CLUSTERS.length,
    boostMeter: 36,
    boostWindowsCaptured: 0,
    boostUseMs: 0,
    lastCrashReason: null,
    message: 'Boost charge refills only during pulse windows. Cut the corner when the ring glows.',
    pointerTarget: {
      x: CLUSTERS[0].x,
      y: CLUSTERS[0].y,
    },
    lastPulseCueIndex: -1,
    player: createPlayer(),
    rivals: RIVAL_DEFS.map(createRival),
    orbs: createOrbs(),
    input: {
      boostPressed: false,
    },
  };
}

function clonePoint(point) {
  return {
    x: point.x,
    y: point.y,
  };
}

function followSegments(snake) {
  for (let index = 1; index < snake.segments.length; index += 1) {
    const leader = snake.segments[index - 1];
    const current = snake.segments[index];
    const dx = leader.x - current.x;
    const dy = leader.y - current.y;
    const separation = Math.hypot(dx, dy);
    if (separation <= EPSILON) {
      continue;
    }
    const targetDistance = snake.segmentSpacing;
    const adjustment = (separation - targetDistance) / separation;
    current.x += dx * adjustment;
    current.y += dy * adjustment;
  }
}

function growSnake(snake, segmentsToAdd = 1) {
  for (let count = 0; count < segmentsToAdd; count += 1) {
    const tail = snake.segments[snake.segments.length - 1];
    snake.segments.push(clonePoint(tail));
  }
}

function moveRival(rival, dt) {
  const head = rival.segments[0];
  const target = rival.waypoints[rival.waypointIndex];
  const desiredAngle = Math.atan2(target.y - head.y, target.x - head.x);
  rival.angle = rotateToward(rival.angle, desiredAngle, rival.turnRate * dt);
  head.x += Math.cos(rival.angle) * rival.speed * dt;
  head.y += Math.sin(rival.angle) * rival.speed * dt;

  if (distance(head, target) <= 20) {
    rival.waypointIndex = (rival.waypointIndex + 1) % rival.waypoints.length;
  }

  followSegments(rival);
}

function awardOrb(state, orb) {
  orb.collected = true;
  state.combo += 1;
  state.peakCombo = Math.max(state.peakCombo, state.combo);
  state.orbsCollectedCount += 1;
  state.score += ORB_SCORE + Math.min(48, state.combo * 4);
  growSnake(state.player, 1);
}

function maybeClearCluster(state, clusterId, boostPhase) {
  const cluster = CLUSTERS.find((item) => item.id === clusterId);
  const remaining = state.orbs.filter((orb) => orb.clusterId === clusterId && !orb.collected);
  if (remaining.length > 0) {
    return;
  }

  const wasAlreadyCleared = state.clustersClearedCount > 0 && state.message.includes(cluster.label);
  const clusterWasCounted = state.score < 0;
  void clusterWasCounted;

  const currentCount = state.orbs.filter((orb) => orb.clusterId === clusterId && orb.collected).length;
  if (currentCount !== 4) {
    return;
  }

  const previouslyCleared = state.completedClusters.has(clusterId);
  if (previouslyCleared) {
    return;
  }

  state.completedClusters.add(clusterId);
  state.clustersClearedCount += 1;
  state.score += CLUSTER_CLEAR_BONUS;

  let bonusText = '';
  if (boostPhase.active) {
    state.score += ACTIVE_WINDOW_CLEAR_BONUS;
    state.boostWindowsCaptured += 1;
    bonusText = ' Pulse bonus locked.';
  }

  state.message = `${cluster.label} cleared.${bonusText}`;

  if (wasAlreadyCleared) {
    state.message = `${cluster.label} cleared.${bonusText}`;
  }
}

function currentPlayerSpeed(state) {
  if (state.input.boostPressed && state.boostMeter > 0) {
    return PLAYER_BOOST_SPEED;
  }
  const growthBonus = Math.min(18, Math.max(0, state.player.segments.length - 10) * 1.2);
  return PLAYER_BASE_SPEED + growthBonus;
}

function crash(state, reason) {
  state.mode = 'crashed';
  state.lastCrashReason = reason;
  state.message = `${reason} Press Enter or Start to rerun the route.`;
  state.input.boostPressed = false;
}

function maybeCollectOrbs(state, boostPhase) {
  const head = state.player.segments[0];
  for (const orb of state.orbs) {
    if (orb.collected) {
      continue;
    }
    if (distance(head, orb) <= PLAYER_RADIUS + ORB_RADIUS + 2) {
      awardOrb(state, orb);
      maybeClearCluster(state, orb.clusterId, boostPhase);
    }
  }
}

function maybeFinish(state) {
  if (state.clustersClearedCount !== state.totalClusters) {
    return;
  }

  state.finishBonus = FINISH_BONUS_BASE + Math.round(state.boostMeter * 2) + state.boostWindowsCaptured * 70;
  state.score += state.finishBonus;
  state.mode = 'finished';
  state.input.boostPressed = false;
  state.message = `Arena cleared in ${(state.elapsedMs / 1000).toFixed(2)}s with ${state.boostWindowsCaptured} pulse bonuses.`;
}

function maybeCrashOnWalls(state) {
  const head = state.player.segments[0];
  if (
    head.x < WORLD.arena.left + PLAYER_RADIUS ||
    head.x > WORLD.arena.right - PLAYER_RADIUS ||
    head.y < WORLD.arena.top + PLAYER_RADIUS ||
    head.y > WORLD.arena.bottom - PLAYER_RADIUS
  ) {
    crash(state, 'The head clipped the arena wall.');
  }
}

function maybeCrashOnRivals(state) {
  if (state.mode !== 'running') {
    return;
  }

  const head = state.player.segments[0];
  for (const rival of state.rivals) {
    for (let index = 2; index < rival.segments.length; index += 1) {
      if (distance(head, rival.segments[index]) <= PLAYER_RADIUS * 1.55) {
        crash(state, `The head clipped ${rival.label}.`);
        return;
      }
    }
  }
}

function setPulseCue(state, boostPhase) {
  if (boostPhase.active && boostPhase.pulseIndex !== state.lastPulseCueIndex) {
    state.lastPulseCueIndex = boostPhase.pulseIndex;
    state.message = 'Pulse window open. Boost charge is refilling fast.';
  }
}

function updateRunning(state, dt) {
  state.elapsedMs += dt * 1000;
  const boostPhase = getBoostPhase(state.elapsedMs);
  setPulseCue(state, boostPhase);

  if (boostPhase.active) {
    state.boostMeter = Math.min(MAX_BOOST, state.boostMeter + BOOST_RECHARGE_PER_SECOND * dt);
  }

  const head = state.player.segments[0];
  const desiredAngle = Math.atan2(state.pointerTarget.y - head.y, state.pointerTarget.x - head.x);
  state.player.angle = rotateToward(state.player.angle, desiredAngle, state.player.turnRate * dt);

  const boosting = state.input.boostPressed && state.boostMeter > 0;
  if (boosting) {
    state.boostMeter = Math.max(0, state.boostMeter - BOOST_DRAIN_PER_SECOND * dt);
    state.boostUseMs += dt * 1000;
    if (state.boostMeter === 0) {
      state.input.boostPressed = false;
    }
  }

  state.player.speed = currentPlayerSpeed(state);
  head.x += Math.cos(state.player.angle) * state.player.speed * dt;
  head.y += Math.sin(state.player.angle) * state.player.speed * dt;
  followSegments(state.player);

  for (const rival of state.rivals) {
    moveRival(rival, dt);
  }

  maybeCrashOnWalls(state);
  maybeCrashOnRivals(state);
  if (state.mode !== 'running') {
    return;
  }

  maybeCollectOrbs(state, boostPhase);
  maybeFinish(state);
}

function sampleBody(body, stride = 3) {
  return body
    .filter((_, index) => index === 0 || index === body.length - 1 || index % stride === 0)
    .map((segment) => ({
      x: round(segment.x, 1),
      y: round(segment.y, 1),
    }));
}

function describeCluster(state, cluster) {
  const remainingOrbs = state.orbs
    .filter((orb) => orb.clusterId === cluster.id && !orb.collected)
    .map((orb) => ({
      x: round(orb.x, 1),
      y: round(orb.y, 1),
    }));

  return {
    id: cluster.id,
    label: cluster.label,
    x: cluster.x,
    y: cluster.y,
    cleared: remainingOrbs.length === 0,
    remaining: remainingOrbs.length,
    remainingOrbs,
  };
}

function createSnapshot(state) {
  const boostPhase = getBoostPhase(state.elapsedMs);
  return {
    seed: state.seed,
    mode: state.mode,
    elapsedMs: Math.round(state.elapsedMs),
    score: Math.round(state.score),
    finishBonus: Math.round(state.finishBonus),
    combo: state.combo,
    peakCombo: state.peakCombo,
    orbsCollectedCount: state.orbsCollectedCount,
    totalOrbs: state.totalOrbs,
    clustersClearedCount: state.clustersClearedCount,
    totalClusters: state.totalClusters,
    boost: {
      meter: round(state.boostMeter, 1),
      active: boostPhase.active,
      progress: round(boostPhase.progress, 3),
      pulseIndex: boostPhase.pulseIndex,
      msUntilPhaseChange: Math.round(boostPhase.msUntilPhaseChange),
      useMs: Math.round(state.boostUseMs),
      capturedWindows: state.boostWindowsCaptured,
    },
    message: state.message,
    lastCrashReason: state.lastCrashReason,
    pointerTarget: {
      x: round(state.pointerTarget.x, 1),
      y: round(state.pointerTarget.y, 1),
    },
    world: {
      width: WORLD.width,
      height: WORLD.height,
      arena: { ...WORLD.arena },
      coordinateSystem: 'origin top-left, x increases right, y increases down',
    },
    player: {
      x: round(state.player.segments[0].x, 1),
      y: round(state.player.segments[0].y, 1),
      angle: round(state.player.angle, 3),
      speed: round(state.player.speed, 1),
      boosting: state.input.boostPressed && state.boostMeter > 0,
      length: state.player.segments.length,
      radius: PLAYER_RADIUS,
      body: state.player.segments.map((segment) => ({
        x: round(segment.x, 1),
        y: round(segment.y, 1),
      })),
    },
    rivals: state.rivals.map((rival) => ({
      id: rival.id,
      label: rival.label,
      color: rival.color,
      x: round(rival.segments[0].x, 1),
      y: round(rival.segments[0].y, 1),
      angle: round(rival.angle, 3),
      speed: rival.speed,
      body: rival.segments.map((segment) => ({
        x: round(segment.x, 1),
        y: round(segment.y, 1),
      })),
    })),
    clusters: CLUSTERS.map((cluster) => describeCluster(state, cluster)),
  };
}

export function renderGameToText(snapshot) {
  const payload = {
    mode: snapshot.mode,
    score: snapshot.score,
    combo: snapshot.combo,
    elapsedMs: snapshot.elapsedMs,
    player: {
      x: snapshot.player.x,
      y: snapshot.player.y,
      angle: snapshot.player.angle,
      speed: snapshot.player.speed,
      boosting: snapshot.player.boosting,
      length: snapshot.player.length,
      bodySample: sampleBody(snapshot.player.body, 4),
    },
    boost: snapshot.boost,
    clusters: snapshot.clusters.map((cluster) => ({
      id: cluster.id,
      remaining: cluster.remaining,
      cleared: cluster.cleared,
      x: cluster.x,
      y: cluster.y,
    })),
    pointerTarget: snapshot.pointerTarget,
    rivals: snapshot.rivals.map((rival) => ({
      id: rival.id,
      x: rival.x,
      y: rival.y,
      bodySample: sampleBody(rival.body, 4),
    })),
    world: snapshot.world,
    message: snapshot.message,
    lastCrashReason: snapshot.lastCrashReason,
  };

  return JSON.stringify(payload);
}

export function createGame({ seed = 20260515 } = {}) {
  let state = {
    ...createInitialState(seed),
    completedClusters: new Set(),
  };

  function reset() {
    state = {
      ...createInitialState(seed),
      completedClusters: new Set(),
    };
  }

  return {
    getState() {
      return createSnapshot(state);
    },
    setPointerTarget(x, y) {
      state.pointerTarget = {
        x: clamp(x, WORLD.arena.left + 12, WORLD.arena.right - 12),
        y: clamp(y, WORLD.arena.top + 12, WORLD.arena.bottom - 12),
      };
    },
    setBoostPressed(value) {
      state.input.boostPressed = Boolean(value);
    },
    startOrRestart() {
      if (state.mode === 'paused') {
        state.mode = 'running';
        state.message = 'Back in motion. Catch the next pulse window.';
        return createSnapshot(state);
      }

      reset();
      state.mode = 'running';
      state.message = 'Route open. Sweep the outer ring and spend boost on the pulse.';
      return createSnapshot(state);
    },
    togglePause() {
      if (state.mode === 'running') {
        state.mode = 'paused';
        state.input.boostPressed = false;
        state.message = 'Paused. The arena pulse is frozen.';
      } else if (state.mode === 'paused') {
        state.mode = 'running';
        state.message = 'Back in motion. Catch the next pulse window.';
      }
      return createSnapshot(state);
    },
    resetToTitle() {
      reset();
      return createSnapshot(state);
    },
    advance(ms) {
      const totalMs = Math.max(0, ms);
      const steps = Math.max(1, Math.round(totalMs / FIXED_STEP_MS));
      const stepSeconds = totalMs / steps / 1000;

      if (state.mode !== 'running') {
        return createSnapshot(state);
      }

      for (let index = 0; index < steps; index += 1) {
        if (state.mode !== 'running') {
          break;
        }
        updateRunning(state, stepSeconds);
      }

      return createSnapshot(state);
    },
  };
}
