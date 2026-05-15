function nearestOrb(cluster, player) {
  if (!cluster || cluster.remainingOrbs.length === 0) {
    return null;
  }

  const sorted = [...cluster.remainingOrbs].sort((left, right) => {
    const leftDistance = Math.hypot(left.x - player.x, left.y - player.y);
    const rightDistance = Math.hypot(right.x - player.x, right.y - player.y);
    return leftDistance - rightDistance;
  });

  return sorted[0];
}

function nextCluster(snapshot) {
  return snapshot.clusters.find((cluster) => !cluster.cleared) ?? null;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const ENTRY_POINTS = {
  'north-west': { x: 226, y: 194 },
  'north-spine': { x: 470, y: 154 },
  'north-east': { x: 684, y: 184 },
  'east-drift': { x: 700, y: 318 },
  'south-spine': { x: 500, y: 384 },
  'south-west': { x: 248, y: 336 },
};

export function createPilot() {
  let hasStarted = false;

  return {
    nextAction(snapshot) {
      const action = {
        buttons: [],
        pointer: {
          x: snapshot.pointerTarget.x,
          y: snapshot.pointerTarget.y,
        },
      };

      if (snapshot.mode === 'title' && !hasStarted) {
        hasStarted = true;
        action.buttons.push('enter');
        return action;
      }

      if (snapshot.mode !== 'running') {
        return action;
      }

      const cluster = nextCluster(snapshot);
      const targetOrb = nearestOrb(cluster, snapshot.player);
      const entry = cluster ? ENTRY_POINTS[cluster.id] : null;
      const shouldUseEntry =
        cluster &&
        entry &&
        (cluster.remaining === 4 || distance(snapshot.player, cluster) > 86) &&
        distance(snapshot.player, entry) > 32;

      if (shouldUseEntry) {
        action.pointer = {
          x: entry.x,
          y: entry.y,
        };
      } else if (targetOrb) {
        action.pointer = {
          x: targetOrb.x,
          y: targetOrb.y,
        };
      } else if (cluster) {
        action.pointer = {
          x: cluster.x,
          y: cluster.y,
        };
      }

      const shouldBoost =
        snapshot.boost.active &&
        snapshot.boost.meter >= 18 &&
        cluster &&
        distance(snapshot.player, action.pointer) >= 120;

      if (shouldBoost) {
        action.buttons.push('space');
      }

      return action;
    },
  };
}

export function applyAction(game, action) {
  if (action.pointer) {
    game.setPointerTarget(action.pointer.x, action.pointer.y);
  }

  let boostPressed = false;
  for (const button of action.buttons) {
    if (button === 'enter') {
      game.startOrRestart();
    } else if (button === 'p') {
      game.togglePause();
    } else if (button === 'r') {
      game.resetToTitle();
    } else if (button === 'space') {
      boostPressed = true;
    }
  }

  game.setBoostPressed(boostPressed);
}

export function advanceWithPilot(game, pilot, stepMs = 100) {
  const before = game.getState();
  const action = pilot.nextAction(before);
  applyAction(game, action);
  const snapshot = game.advance(stepMs);
  return {
    action,
    snapshot,
  };
}
