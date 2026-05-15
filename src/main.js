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
        <h1>Slither.io: Timed Boosts</h1>
        <p class="lede">
          Trace a clean line through the arena, grow on fixed orb clusters, and
          spend speed only when the pulse window lights up. Rival patrols never
          change, so the tension is in how precisely you cut the route.
        </p>
        <div class="controls">
          <button data-action="start">Start / Restart</button>
          <button data-action="pause">Pause</button>
          <button data-action="reset">Reset</button>
        </div>
        <ul class="legend">
          <li><strong>Steer</strong> Move the mouse or tap arrow keys / WASD</li>
          <li><strong>Boost</strong> Hold Space during pulse windows</li>
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
        <div><span>Length</span><strong data-stat="length"></strong></div>
        <div><span>Clusters</span><strong data-stat="clusters"></strong></div>
        <div><span>Boost</span><strong data-stat="boost"></strong></div>
        <div><span>Pulse</span><strong data-stat="pulse"></strong></div>
      </div>
      <p class="message" data-message></p>
      <pre class="telemetry" data-telemetry></pre>
    </section>
  </main>
`;

const game = createGame({ seed: 20260515 });
const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const telemetry = document.querySelector('[data-telemetry]');
const message = document.querySelector('[data-message]');
const statElements = {
  mode: document.querySelector('[data-stat="mode"]'),
  score: document.querySelector('[data-stat="score"]'),
  length: document.querySelector('[data-stat="length"]'),
  clusters: document.querySelector('[data-stat="clusters"]'),
  boost: document.querySelector('[data-stat="boost"]'),
  pulse: document.querySelector('[data-stat="pulse"]'),
};

const startButton = document.querySelector('[data-action="start"]');
const pauseButton = document.querySelector('[data-action="pause"]');
const resetButton = document.querySelector('[data-action="reset"]');

let lastSnapshot = game.getState();
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
  sky.addColorStop(0, '#fff4d1');
  sky.addColorStop(0.45, '#d6fff2');
  sky.addColorStop(1, '#0f3950');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  for (let index = 0; index < 10; index += 1) {
    const waveX = (index * 118 + snapshot.elapsedMs * 0.03) % (WORLD.width + 160);
    ctx.fillStyle = index % 2 === 0 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(31, 121, 140, 0.1)';
    ctx.beginPath();
    ctx.ellipse(waveX - 60, 80 + index * 22, 92, 22, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255, 244, 200, 0.58)';
  ctx.beginPath();
  ctx.arc(800, 106, 64, 0, Math.PI * 2);
  ctx.fill();
}

function drawArena(snapshot) {
  const { arena } = snapshot.world;
  const panel = ctx.createLinearGradient(arena.left, arena.top, arena.right, arena.bottom);
  panel.addColorStop(0, '#103d49');
  panel.addColorStop(0.55, '#145c66');
  panel.addColorStop(1, '#103947');
  drawRoundedRect(
    arena.left,
    arena.top,
    arena.right - arena.left,
    arena.bottom - arena.top,
    32,
    panel,
    'rgba(255, 255, 255, 0.28)'
  );

  const pulseOpacity = snapshot.boost.active ? 0.34 : 0.08;
  ctx.strokeStyle = `rgba(255, 243, 200, ${pulseOpacity})`;
  ctx.lineWidth = snapshot.boost.active ? 6 : 2;
  ctx.strokeRect(arena.left + 10, arena.top + 10, arena.right - arena.left - 20, arena.bottom - arena.top - 20);

  ctx.strokeStyle = 'rgba(181, 255, 244, 0.16)';
  ctx.lineWidth = 1;
  for (let x = arena.left + 28; x < arena.right; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, arena.top + 16);
    ctx.lineTo(x, arena.bottom - 16);
    ctx.stroke();
  }
  for (let y = arena.top + 24; y < arena.bottom; y += 40) {
    ctx.beginPath();
    ctx.moveTo(arena.left + 16, y);
    ctx.lineTo(arena.right - 16, y);
    ctx.stroke();
  }

  if (snapshot.boost.active) {
    const pulseX = arena.left + 20 + snapshot.boost.progress * (arena.right - arena.left - 40);
    ctx.fillStyle = 'rgba(255, 241, 166, 0.18)';
    ctx.fillRect(pulseX - 26, arena.top + 14, 52, arena.bottom - arena.top - 28);
  }
}

function drawPointer(snapshot) {
  if (snapshot.mode !== 'running' && snapshot.mode !== 'paused') {
    return;
  }

  ctx.save();
  ctx.strokeStyle = snapshot.boost.active ? '#fff1a7' : 'rgba(245, 255, 251, 0.55)';
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(snapshot.pointerTarget.x, snapshot.pointerTarget.y, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawClusters(snapshot) {
  for (const cluster of snapshot.clusters) {
    ctx.strokeStyle = cluster.cleared ? 'rgba(240, 255, 249, 0.18)' : 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = cluster.cleared ? 1 : 2;
    ctx.beginPath();
    ctx.arc(cluster.x, cluster.y, 36, 0, Math.PI * 2);
    ctx.stroke();

    if (!cluster.cleared) {
      ctx.fillStyle = 'rgba(255, 248, 210, 0.72)';
      ctx.font = '12px "Avenir Next Condensed", "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cluster.label, cluster.x, cluster.y - 48);
    }

    for (const orb of cluster.remainingOrbs) {
      ctx.fillStyle = snapshot.boost.active ? '#fff2a8' : '#f5fff9';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = snapshot.boost.active ? 'rgba(255, 196, 106, 0.26)' : 'rgba(102, 255, 223, 0.22)';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSnake(body, color, headColor, width) {
  if (body.length < 2) {
    return;
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(body[body.length - 1].x, body[body.length - 1].y);
  for (let index = body.length - 2; index >= 0; index -= 1) {
    ctx.lineTo(body[index].x, body[index].y);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = Math.max(4, width * 0.28);
  ctx.stroke();

  const head = body[0];
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.arc(head.x, head.y, width * 0.46, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0b2431';
  ctx.beginPath();
  ctx.arc(head.x + width * 0.12, head.y - width * 0.1, width * 0.08, 0, Math.PI * 2);
  ctx.arc(head.x + width * 0.12, head.y + width * 0.1, width * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnakes(snapshot) {
  for (const rival of snapshot.rivals) {
    drawSnake(rival.body, rival.color, '#fff7ec', 15);
  }
  drawSnake(snapshot.player.body, '#1ad0bc', '#eafff7', 18);
}

function drawHud(snapshot) {
  drawRoundedRect(108, 82, 218, 82, 22, 'rgba(7, 31, 41, 0.58)', 'rgba(255, 255, 255, 0.18)');
  ctx.fillStyle = '#f4fff9';
  ctx.textAlign = 'left';
  ctx.font = '700 18px "Avenir Next Condensed", "Trebuchet MS", sans-serif';
  ctx.fillText(`Score ${snapshot.score}`, 128, 114);
  ctx.font = '600 15px "Trebuchet MS", sans-serif';
  ctx.fillText(`Length ${snapshot.player.length}`, 128, 138);
  ctx.fillText(`Clusters ${snapshot.clustersClearedCount}/${snapshot.totalClusters}`, 228, 138);

  const barX = 648;
  const barY = 90;
  const barWidth = 184;
  drawRoundedRect(barX, barY, barWidth, 22, 14, 'rgba(8, 27, 38, 0.52)', 'rgba(255, 255, 255, 0.18)');
  drawRoundedRect(
    barX + 4,
    barY + 4,
    (barWidth - 8) * (snapshot.boost.meter / 100),
    14,
    10,
    snapshot.boost.active ? '#fff1a7' : '#8aeede'
  );
  ctx.fillStyle = '#f5fff6';
  ctx.textAlign = 'center';
  ctx.font = '700 14px "Trebuchet MS", sans-serif';
  ctx.fillText(snapshot.boost.active ? 'Pulse Window Live' : 'Pulse Window Charging', barX + barWidth / 2, 128);
}

function drawOverlay(snapshot) {
  if (snapshot.mode === 'running') {
    return;
  }

  ctx.fillStyle = 'rgba(7, 28, 36, 0.42)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  drawRoundedRect(206, 126, 548, 238, 30, 'rgba(255, 252, 241, 0.94)');
  ctx.fillStyle = '#123448';
  ctx.textAlign = 'center';
  ctx.font = '700 38px "Avenir Next Condensed", "Trebuchet MS", sans-serif';

  let title = 'Timed Boost Arena';
  let body = 'Press Enter or Start to begin. Sweep the outer route and only spend boost when the pulse window opens.';
  if (snapshot.mode === 'paused') {
    title = 'Paused';
    body = 'Press P or Start to resume. The snakes, pulse window, and boost meter are frozen.';
  } else if (snapshot.mode === 'crashed') {
    title = 'Run Wiped';
    body = `${snapshot.lastCrashReason} Press Enter or Start to replay the fixed route.`;
  } else if (snapshot.mode === 'finished') {
    title = 'Arena Cleared';
    body = `Finished in ${(snapshot.elapsedMs / 1000).toFixed(2)}s with ${snapshot.boost.capturedWindows} pulse bonuses. Press Enter or Start to replay.`;
  }

  ctx.fillText(title, WORLD.width / 2, 198);
  ctx.font = '600 20px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#39596b';
  wrapCenteredText(body, WORLD.width / 2, 242, 420, 30);
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

function drawScene(snapshot) {
  drawBackdrop(snapshot);
  drawArena(snapshot);
  drawPointer(snapshot);
  drawClusters(snapshot);
  drawSnakes(snapshot);
  drawHud(snapshot);
  drawOverlay(snapshot);
}

function render(snapshot = game.getState()) {
  lastSnapshot = snapshot;
  drawScene(snapshot);

  statElements.mode.textContent = snapshot.mode;
  statElements.score.textContent = String(snapshot.score);
  statElements.length.textContent = String(snapshot.player.length);
  statElements.clusters.textContent = `${snapshot.clustersClearedCount}/${snapshot.totalClusters}`;
  statElements.boost.textContent = `${Math.round(snapshot.boost.meter)}%`;
  statElements.pulse.textContent = snapshot.boost.active
    ? `${Math.round(snapshot.boost.msUntilPhaseChange / 100) / 10}s live`
    : `${Math.round(snapshot.boost.msUntilPhaseChange / 100) / 10}s`;
  message.textContent = snapshot.message;
  telemetry.textContent = renderGameToText(snapshot);
}

function updatePointerFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * WORLD.width;
  const y = ((clientY - rect.top) / rect.height) * WORLD.height;
  game.setPointerTarget(x, y);
  render();
}

function nudgePointer(dx, dy) {
  game.setPointerTarget(lastSnapshot.player.x + dx, lastSnapshot.player.y + dy);
  render();
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }
  document.documentElement.requestFullscreen();
}

startButton.addEventListener('click', () => {
  render(game.startOrRestart());
});

pauseButton.addEventListener('click', () => {
  render(game.togglePause());
});

resetButton.addEventListener('click', () => {
  render(game.resetToTitle());
});

canvas.addEventListener('mousemove', (event) => {
  updatePointerFromClient(event.clientX, event.clientY);
});

canvas.addEventListener(
  'touchmove',
  (event) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    updatePointerFromClient(touch.clientX, touch.clientY);
  },
  { passive: true }
);

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    game.setBoostPressed(true);
    return;
  }
  if (event.code === 'Enter') {
    render(game.startOrRestart());
    return;
  }
  if (event.code === 'KeyP') {
    render(game.togglePause());
    return;
  }
  if (event.code === 'KeyR') {
    render(game.resetToTitle());
    return;
  }
  if (event.code === 'KeyF') {
    toggleFullscreen();
    return;
  }

  const step = 150;
  if (event.code === 'ArrowUp' || event.code === 'KeyW') {
    nudgePointer(0, -step);
  } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
    nudgePointer(0, step);
  } else if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
    nudgePointer(-step, 0);
  } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
    nudgePointer(step, 0);
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') {
    game.setBoostPressed(false);
  }
});

window.advanceTime = (ms) => {
  const snapshot = game.advance(ms);
  render(snapshot);
  return snapshot;
};

window.render_game_to_text = () => renderGameToText(game.getState());
window.getAutomationState = () => game.getState();
window.setAutomationPointer = (x, y) => {
  game.setPointerTarget(x, y);
  render();
};
window.setAutomationBoost = (pressed) => {
  game.setBoostPressed(pressed);
};

function frame(timestamp) {
  if (!manualClock) {
    const delta = Math.min(32, timestamp - lastTimestamp);
    if (delta > 0) {
      render(game.advance(delta));
    }
  }
  lastTimestamp = timestamp;
  requestAnimationFrame(frame);
}

if (autoStart) {
  render(game.startOrRestart());
} else {
  render();
}

requestAnimationFrame(frame);
