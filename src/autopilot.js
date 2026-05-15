export function createPilot() {
  const jumpedObstacles = new Set();
  let runStarted = false;

  return {
    nextButtons(snapshot) {
      if (snapshot.mode === 'title' && !runStarted) {
        runStarted = true;
        return ['enter'];
      }

      if (snapshot.mode !== 'running') {
        return [];
      }

      const nextObstacle = snapshot.upcoming.find(
        (obstacle) => !obstacle.cleared && obstacle.screenX + obstacle.width >= snapshot.player.x - 16
      );

      if (
        nextObstacle &&
        !jumpedObstacles.has(nextObstacle.id) &&
        snapshot.player.grounded &&
        nextObstacle.screenX <= nextObstacle.jumpCue + snapshot.speed * 0.22
      ) {
        jumpedObstacles.add(nextObstacle.id);
        return ['space'];
      }

      return [];
    },
  };
}

export function applyButtons(game, buttons) {
  for (const button of buttons) {
    if (button === 'space') {
      game.queueJump();
    } else if (button === 'enter') {
      game.startOrRestart();
    } else if (button === 'p') {
      game.togglePause();
    } else if (button === 'r') {
      game.resetToTitle();
    }
  }
}

export function advanceWithPilot(game, pilot, stepMs = 100) {
  const before = game.getState();
  const buttons = pilot.nextButtons(before);
  applyButtons(game, buttons);
  return {
    buttons,
    snapshot: game.advance(stepMs),
  };
}
