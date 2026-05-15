import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { chromium } from 'playwright';

import { createPilot } from '../src/autopilot.js';
import { FIXED_STEP_MS } from '../src/game-core.js';

const root = process.cwd();
const outDir = path.join(root, 'artifacts', 'playwright');
const gifDir = path.join(root, 'assets', 'gifs');

mkdirSync(outDir, { recursive: true });
mkdirSync(gifDir, { recursive: true });

const server = spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', '4173'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let ready = false;
const logs = [];

function collect(chunk) {
  const text = chunk.toString();
  logs.push(text);
  if (text.includes('http://127.0.0.1:4173')) {
    ready = true;
  }
}

server.stdout.on('data', collect);
server.stderr.on('data', collect);

async function waitReady(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (!ready) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('dev server did not become ready in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

async function getState(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

function writeJson(name, payload) {
  writeFileSync(path.join(outDir, name), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function createGif(framesDir, outputFile) {
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      '6',
      '-i',
      path.join(framesDir, 'frame-%02d.png'),
      '-vf',
      'scale=1280:-1:flags=lanczos',
      outputFile,
    ],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${outputFile}: ${result.stderr || result.stdout}`);
  }
}

async function createFramesDir(name) {
  const dir = path.join(outDir, `frames-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function captureFrame(page, dir, index) {
  await page.screenshot({
    path: path.join(dir, `frame-${String(index).padStart(2, '0')}.png`),
    fullPage: true,
  });
}

function actionStep(buttons, frames, point) {
  return {
    buttons,
    mouse_x: point.x,
    mouse_y: point.y,
    frames,
  };
}

function keyForButton(button) {
  if (button === 'space') {
    return 'Space';
  }
  if (button === 'enter') {
    return 'Enter';
  }
  if (button === 'p') {
    return 'KeyP';
  }
  if (button === 'r') {
    return 'KeyR';
  }
  throw new Error(`unsupported button ${button}`);
}

async function runStep(page, buttons, frames, point, actionSteps) {
  for (const button of buttons) {
    await page.keyboard.press(keyForButton(button));
  }
  actionSteps.push(actionStep(buttons, frames, point));
  await page.evaluate((ms) => {
    window.advanceTime(ms);
  }, Math.round(frames * FIXED_STEP_MS));
  return getState(page);
}

(async () => {
  let browser;
  try {
    await waitReady();

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1460 } });
    const url = 'http://127.0.0.1:4173/?manual_clock=1';
    const pilot = createPilot();
    const actionSteps = [];
    const trace = [];

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.advanceTime === 'function');
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');

    const canvas = page.locator('#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error('game canvas not found');
    }
    const point = {
      x: Math.round(box.x + box.width / 2),
      y: Math.round(box.y + box.height / 2),
    };

    const openingFrames = await createFramesDir('opening-surge');
    const ladderFrames = await createFramesDir('pulse-ladder');
    const finishFrames = await createFramesDir('finish-banner');

    let snapshot = await getState(page);
    await page.screenshot({ path: path.join(outDir, 'shot-0-title-start.png'), fullPage: true });
    writeJson('state-0-title-start.json', snapshot);
    await captureFrame(page, openingFrames, 0);

    snapshot = await runStep(page, ['enter'], 1, point, actionSteps);

    let openingIndex = 1;
    let ladderIndex = 0;
    let finishIndex = 0;
    let openingShotDone = false;
    let pulseShotDone = false;
    let paused = false;
    let resumed = false;

    for (let step = 0; step < 420; step += 1) {
      trace.push({
        step,
        mode: snapshot.mode,
        cleared: snapshot.clearedCount,
        rings: snapshot.ringsCollectedCount,
        progress: snapshot.progress,
        next: snapshot.upcoming[0]
          ? {
              id: snapshot.upcoming[0].id,
              screenX: snapshot.upcoming[0].screenX,
              jumpCue: snapshot.upcoming[0].jumpCue,
              maxHeight: snapshot.upcoming[0].maxHeight,
            }
          : null,
      });

      if (!paused && snapshot.clearedCount >= 4) {
        const beforePause = snapshot;
        snapshot = await runStep(page, ['p'], 12, point, actionSteps);
        const afterPause = await getState(page);
        await page.screenshot({ path: path.join(outDir, 'shot-3-paused.png'), fullPage: true });
        writeJson('state-3-paused.json', {
          before: beforePause,
          after: afterPause,
        });
        paused = true;
        continue;
      }

      if (paused && !resumed && snapshot.mode === 'paused') {
        snapshot = await runStep(page, ['p'], 2, point, actionSteps);
        resumed = true;
      }

      if (snapshot.mode === 'finished' || snapshot.mode === 'crashed') {
        break;
      }

      const buttons = pilot.nextButtons(snapshot);
      snapshot = await runStep(page, buttons, 3, point, actionSteps);

      if (snapshot.clearedCount <= 2 && openingIndex < 7) {
        await captureFrame(page, openingFrames, openingIndex);
        openingIndex += 1;
      }

      if (snapshot.clearedCount >= 3 && snapshot.clearedCount <= 6 && ladderIndex < 7) {
        await captureFrame(page, ladderFrames, ladderIndex);
        ladderIndex += 1;
      }

      if (snapshot.progress >= 78 && finishIndex < 7) {
        await captureFrame(page, finishFrames, finishIndex);
        finishIndex += 1;
      }

      if (!openingShotDone && snapshot.clearedCount >= 2) {
        await page.screenshot({ path: path.join(outDir, 'shot-1-opening-surge.png'), fullPage: true });
        writeJson('state-1-opening-surge.json', snapshot);
        openingShotDone = true;
      }

      if (!pulseShotDone && snapshot.clearedCount >= 6) {
        await page.screenshot({ path: path.join(outDir, 'shot-2-pulse-ladder.png'), fullPage: true });
        writeJson('state-2-pulse-ladder.json', snapshot);
        pulseShotDone = true;
      }
    }

    if (snapshot.mode !== 'finished') {
      writeJson('debug-trace.json', trace);
      writeJson('debug-last-state.json', snapshot);
      throw new Error(`expected finished state, got ${snapshot.mode}: ${snapshot.lastCrashReason ?? 'no reason'}`);
    }

    await page.screenshot({ path: path.join(outDir, 'shot-4-finish-banner.png'), fullPage: true });
    writeJson('state-4-finish-banner.json', snapshot);
    writeFileSync(path.join(outDir, 'render_game_to_text.txt'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

    snapshot = await runStep(page, ['r'], 1, point, actionSteps);
    await page.screenshot({ path: path.join(outDir, 'shot-5-reset-title.png'), fullPage: true });
    writeJson('state-5-reset-title.json', snapshot);
    writeJson('action_payload.json', { steps: actionSteps });

    createGif(openingFrames, path.join(gifDir, 'clip-01-opening-surge.gif'));
    createGif(ladderFrames, path.join(gifDir, 'clip-02-pulse-ladder.gif'));
    createGif(finishFrames, path.join(gifDir, 'clip-03-finish-banner.gif'));
    writeFileSync(path.join(outDir, 'dev-server.log'), logs.join(''), 'utf8');
  } finally {
    if (browser) {
      await browser.close();
    }
    server.kill('SIGTERM');
  }
})().catch((error) => {
  writeFileSync(path.join(outDir, 'dev-server.log'), logs.join(''), 'utf8');
  console.error(error);
  process.exitCode = 1;
});
