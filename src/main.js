import { createGame, renderGameToText, WORLD } from './game-core.js';
import './style.css';

const app = document.querySelector('#app');
const params = new URLSearchParams(window.location.search);
const manualClock = params.get('manual_clock') === '1';
const autoStart = params.get('autostart') === '1';

app.innerHTML = `
  <main class="layout">
    <section class="hero-card">
      <div class="copy">
        <p class="eyebrow">Daily Classic Game</p>
        <h1>Endless Jumper: Dynamic Obstacles</h1>
        <p class="lede">
          Sprint through a skyline of pulse lanes that rise and fall on fixed
          rhythms. The route is deterministic, but each jump still has to hit
          the open phase.
        </p>
        <div class="controls">
          <button data-action="start">Start / Restart</button>
          <button data-action="pause">Pause</button>
          <button data-action="reset">Reset</button>
        </div>
        <ul class="legend">
          <li><strong>Jump</strong> Space, W, ArrowUp</li>
          <li><strong>Pause</strong> P</li>
          <li><strong>Reset</strong> R</li>
          <li><strong>Fullscreen</strong> F</li>
        </ul>
      </div>
      <div class="stage-wrap">
        <canvas id="game-canvas" width="${WORLD.width}" height="${WORLD.height}"></canvas>
      </div>
    </section>
    <section class="status-card">
      <div class="stats">
        <div><span>Mode</span><strong data-stat="mode"></strong></div>
        <div><span>Score</span><strong data-stat="score"></strong></div>
        <div><span>Progress</span><strong data-stat="progress"></strong></div>
        <div><span>Cleared</span><strong data-stat="cleared"></strong></div>
        <div><span>Rings</span><strong data-stat="rings"></strong></div>
        <div><span>Speed</span><strong data-stat="speed"></strong></div>
      </div>
      <p class="message" data-message></p>
      <pre class="telemetry" data-telemetry></pre>
    </section>
  </main>
`;

const game = createGame({ seed: 20260513 });
const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const telemetry = document.querySelector('[data-telemetry]');
const message = document.querySelector('[data-message]');
const statElements = {
  mode: document.querySelector('[data-stat="mode"]'),
  score: document.querySelector('[data-stat="score"]'),
  progress: document.querySelector('[data-stat="progress"]'),
  cleared: document.querySelector('[data-stat="cleared"]'),
  rings: document.querySelector('[data-stat="rings"]'),
  speed: document.querySelector('[data-stat="speed"]'),
};

const startButton = document.querySelector('[data-action="start"]');
const pauseButton = document.querySelector('[data-action="pause"]');
const resetButton = document.querySelector('[data-action="reset"]');

let lastTimestamp = performance.now();

function drawRoundedRect(x, y, width, height, radius, fillStyle, strokeStyle = null) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }
}

function drawBackdrop(snapshot) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  sky.addColorStop(0, '#fff8d6');
  sky.addColorStop(0.42, '#ffd2a8');
  sky.addColorStop(1, '#243a73');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = 'rgba(255, 241, 171, 0.68)';
  ctx.beginPath();
  ctx.arc(740, 104, 68, 0, Math.PI * 2);
  ctx.fill();

  for (let index = 0; index < 12; index += 1) {
    const stripX = ((index * 120) - (snapshot.distance * 0.24)) % (WORLD.width + 120);
    ctx.fillStyle = index % 2 === 0 ? 'rgba(255,255,255,0.09)' : 'rgba(45,77,128,0.14)';
    ctx.fillRect(stripX - 120, 0, 72, WORLD.height);
  }

  for (let layer = 0; layer < 3; layer += 1) {
    const baseY = 248 + layer * 46;
    const height = 120 - layer * 18;
    const speed = 0.12 + layer * 0.05;
    ctx.fillStyle = layer === 0 ? 'rgba(53, 88, 140, 0.18)' : layer === 1 ? 'rgba(37, 59, 104, 0.28)' : 'rgba(22, 34, 69, 0.4)';
    for (let x = -60; x < WORLD.width + 120; x += 88) {
      const drift = ((x - snapshot.distance * speed) % (WORLD.width + 120)) - 60;
      const towerHeight = height + ((x / 44 + layer * 13) % 3) * 20;
      ctx.fillRect(drift, baseY - towerHeight, 54, towerHeight);
    }
  }
}

function drawGround(snapshot) {
  const laneGradient = ctx.createLinearGradient(0, WORLD.groundY - 44, 0, WORLD.height);
  laneGradient.addColorStop(0, '#21435d');
  laneGradient.addColorStop(1, '#102233');
  ctx.fillStyle = laneGradient;
  ctx.fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY);

  ctx.fillStyle = 'rgba(255, 203, 97, 0.18)';
  ctx.fillRect(0, WORLD.groundY - 12, WORLD.width, 12);

  ctx.strokeStyle = 'rgba(255, 236, 171, 0.6)';
  ctx.lineWidth = 2;
  for (let x = -80; x < WORLD.width + 120; x += 64) {
    const drift = ((x - snapshot.distance * 0.8) % (WORLD.width + 120)) - 40;
    ctx.beginPath();
    ctx.moveTo(drift, WORLD.groundY + 4);
    ctx.lineTo(drift + 38, WORLD.groundY + 24);
    ctx.stroke();
  }
}

function drawRings(snapshot) {
  for (const ring of snapshot.rings) {
    ctx.save();
    ctx.translate(ring.screenX, ring.y);
    ctx.strokeStyle = '#fff6b1';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, ring.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawObstacles(snapshot) {
  for (const obstacle of snapshot.upcoming) {
    const labelX = obstacle.screenX + obstacle.width / 2;
    ctx.fillStyle = 'rgba(255, 232, 196, 0.86)';
    ctx.font = '12px "Avenir Next Condensed", "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(obstacle.label, labelX, 34);

    for (const segment of obstacle.segments) {
      const segmentX = obstacle.screenX + segment.offsetX;
      const segmentY = WORLD.groundY - segment.height;
      const pulse = segment.pulse;
      const fill = ctx.createLinearGradient(0, segmentY, 0, WORLD.groundY);
      fill.addColorStop(0, pulse > 0.65 ? '#f5624d' : '#ff9a5a');
      fill.addColorStop(1, '#7e223f');
      drawRoundedRect(segmentX, segmentY, segment.width, segment.height, 12, fill, 'rgba(255, 243, 193, 0.65)');
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(segmentX + 8, segmentY + 10, segment.width - 16, Math.max(8, segment.height * 0.18));
    }

    ctx.strokeStyle = 'rgba(255, 245, 208, 0.26)';
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(obstacle.screenX + obstacle.jumpCue, 0);
    ctx.lineTo(obstacle.screenX + obstacle.jumpCue, WORLD.height);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawPlayer(snapshot) {
  const { player } = snapshot;
  const flash = snapshot.mode === 'running' && snapshot.player.grounded ? snapshot.pulseBeat * 0.2 : 0.1;
  const bodyGradient = ctx.createLinearGradient(player.x, player.y, player.x, player.y + player.height);
  bodyGradient.addColorStop(0, '#1df0d8');
  bodyGradient.addColorStop(1, '#149ca4');
  drawRoundedRect(player.x, player.y + 10, player.width, player.height - 10, 18, bodyGradient, 'rgba(255,255,255,0.45)');

  ctx.fillStyle = '#081d2f';
  ctx.beginPath();
  ctx.arc(player.x + player.width * 0.62, player.y + 18, 16, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffe7b5';
  ctx.beginPath();
  ctx.arc(player.x + player.width * 0.62, player.y + 22, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(255, 252, 188, ${0.22 + flash})`;
  ctx.beginPath();
  ctx.ellipse(player.x - 18, player.y + player.height - 10, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!player.grounded) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x + 12, player.y + player.height - 8);
    ctx.lineTo(player.x - 26, player.y + player.height + 16);
    ctx.stroke();
  }
}

function drawOverlay(snapshot) {
  if (snapshot.mode === 'running') {
    return;
  }

  ctx.fillStyle = 'rgba(8, 18, 37, 0.34)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  drawRoundedRect(210, 118, 540, 246, 28, 'rgba(255, 251, 241, 0.92)');
  ctx.fillStyle = '#142644';
  ctx.textAlign = 'center';
  ctx.font = '700 38px "Avenir Next Condensed", "Trebuchet MS", sans-serif';

  let title = 'Pulse Lane Run';
  let body = 'Press Enter or Start to begin. Every obstacle moves on a deterministic rhythm.';
  if (snapshot.mode === 'paused') {
    title = 'Paused';
    body = 'Press P or Start to resume. The timer and obstacle pulses stay frozen while paused.';
  } else if (snapshot.mode === 'crashed') {
    title = 'Run Wiped';
    body = `${snapshot.lastCrashReason} Press Enter or Start to rerun the route.`;
  } else if (snapshot.mode === 'finished') {
    title = 'Finish Surge';
    body = `Route cleared in ${(snapshot.elapsedMs / 1000).toFixed(2)}s. Press Enter or Start to replay the proof run.`;
  }

  ctx.fillText(title, WORLD.width / 2, 186);
  ctx.font = '600 19px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#2f4d77';
  wrapCenteredText(body, WORLD.width / 2, 226, 420, 28);
}

function wrapCenteredText(text, centerX, startY, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let y = startY;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, centerX, y);
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, centerX, y);
  }
}

function render(snapshot) {
  drawBackdrop(snapshot);
  drawGround(snapshot);
  drawRings(snapshot);
  drawObstacles(snapshot);
  drawPlayer(snapshot);
  drawOverlay(snapshot);

  statElements.mode.textContent = snapshot.mode;
  statElements.score.textContent = snapshot.score.toString();
  statElements.progress.textContent = `${snapshot.progress.toFixed(1)}%`;
  statElements.cleared.textContent = `${snapshot.clearedCount}/${snapshot.totalObstacles}`;
  statElements.rings.textContent = `${snapshot.ringsCollectedCount}/${snapshot.totalRings}`;
  statElements.speed.textContent = `${snapshot.speed.toFixed(0)} px/s`;
  message.textContent = snapshot.message;
  telemetry.textContent = renderGameToText(snapshot);
  pauseButton.textContent = snapshot.mode === 'paused' ? 'Resume' : 'Pause';
}

function advance(ms) {
  return render(game.advance(ms));
}

function jump() {
  render(game.queueJump());
}

function startOrRestart() {
  render(game.startOrRestart());
}

function togglePause() {
  render(game.togglePause());
}

function resetToTitle() {
  render(game.resetToTitle());
}

startButton.addEventListener('click', startOrRestart);
pauseButton.addEventListener('click', togglePause);
resetButton.addEventListener('click', resetToTitle);

window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
    event.preventDefault();
    if (game.getState().mode === 'title') {
      game.startOrRestart();
    }
    jump();
    return;
  }

  if (event.code === 'Enter') {
    event.preventDefault();
    startOrRestart();
    return;
  }

  if (event.code === 'KeyP') {
    event.preventDefault();
    togglePause();
    return;
  }

  if (event.code === 'KeyR') {
    event.preventDefault();
    resetToTitle();
    return;
  }

  if (event.code === 'KeyF') {
    event.preventDefault();
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      canvas.requestFullscreen?.();
    }
  }
});

window.render_game_to_text = () => renderGameToText(game.getState());
window.advanceTime = (ms) => {
  render(game.advance(ms));
};

function frame(now) {
  const delta = Math.min(48, now - lastTimestamp);
  lastTimestamp = now;
  if (!manualClock) {
    render(game.advance(delta));
    requestAnimationFrame(frame);
  }
}

render(game.getState());
if (autoStart) {
  render(game.startOrRestart());
}
if (!manualClock) {
  requestAnimationFrame(frame);
}
