import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { chromium } from 'playwright';

import { createPilot } from '../src/autopilot.js';
import { FIXED_STEP_MS, WORLD } from '../src/game-core.js';

const root = process.cwd();
const outDir = path.join(root, 'artifacts', 'playwright');
const gifDir = path.join(root, 'assets', 'gifs');
const RUN_STEP_FRAMES = 5;

rmSync(outDir, { recursive: true, force: true });
rmSync(gifDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(gifDir, { recursive: true });

const server = spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', '4173'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let ready = false;
const serverLogs = [];

function collectServerLog(chunk) {
  const text = chunk.toString();
  serverLogs.push(text);
  if (text.includes('http://127.0.0.1:4173')) {
    ready = true;
  }
}

server.stdout.on('data', collectServerLog);
server.stderr.on('data', collectServerLog);

async function waitReady(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (!ready) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('dev server did not become ready in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
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

function toPagePoint(box, point) {
  return {
    x: Math.round(box.x + (point.x / WORLD.width) * box.width),
    y: Math.round(box.y + (point.y / WORLD.height) * box.height),
  };
}

async function getState(page) {
  return page.evaluate(() => window.getAutomationState());
}

(async () => {
  let browser;
  const browserLogs = [];
  const heldKeys = new Set();
  const actionSteps = [];
  const trace = [];
  let lastSnapshot = null;

  function releaseHeldKeys(page) {
    const releases = [];
    for (const key of heldKeys) {
      if (key === 'space') {
        releases.push(page.keyboard.up('Space'));
      }
    }
    heldKeys.clear();
    return Promise.all(releases);
  }

  async function syncButtons(page, buttons) {
    const wantsBoost = buttons.includes('space');
    if (wantsBoost && !heldKeys.has('space')) {
      await page.keyboard.down('Space');
      heldKeys.add('space');
    }
    if (!wantsBoost && heldKeys.has('space')) {
      await page.keyboard.up('Space');
      heldKeys.delete('space');
    }

    if (buttons.includes('enter')) {
      await page.keyboard.press('Enter');
    }
    if (buttons.includes('p')) {
      await page.keyboard.press('KeyP');
    }
    if (buttons.includes('r')) {
      await page.keyboard.press('KeyR');
    }
  }

  try {
    await waitReady();

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1460 } });
    page.on('console', (message) => {
      browserLogs.push(`[${message.type()}] ${message.text()}`);
    });
    page.on('pageerror', (error) => {
      browserLogs.push(`[pageerror] ${error.message}`);
    });

    const pilot = createPilot();
    const url = 'http://127.0.0.1:4173/?manual_clock=1';

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.advanceTime === 'function');
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    await page.waitForFunction(() => typeof window.getAutomationState === 'function');

    const canvas = page.locator('#game-canvas');
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error('game canvas not found');
    }

    const openingFrames = await createFramesDir('arena-opening');
    const boostFrames = await createFramesDir('boost-corridor');
    const finishFrames = await createFramesDir('finish-banner');

    let snapshot = await getState(page);
    lastSnapshot = snapshot;
    await page.screenshot({ path: path.join(outDir, 'shot-0-title-start.png'), fullPage: true });
    writeJson('state-0-title-start.json', snapshot);
    await captureFrame(page, openingFrames, 0);

    let openingFrameIndex = 1;
    let boostFrameIndex = 0;
    let finishFrameIndex = 0;
    let openingShotDone = false;
    let boostShotDone = false;
    let pauseShotDone = false;

    for (let step = 0; step < 560; step += 1) {
      const action = pilot.nextAction(snapshot);
      const frames = snapshot.mode === 'title' ? 1 : RUN_STEP_FRAMES;
      const targetPoint = action.pointer ?? snapshot.pointerTarget;
      const pagePoint = toPagePoint(box, targetPoint);

      await page.mouse.move(pagePoint.x, pagePoint.y);
      await page.evaluate((point) => {
        window.setAutomationPointer(point.x, point.y);
      }, targetPoint);
      await syncButtons(page, action.buttons);

      actionSteps.push({
        buttons: action.buttons,
        mouse_x: pagePoint.x,
        mouse_y: pagePoint.y,
        frames,
      });

      snapshot = await page.evaluate((ms) => window.advanceTime(ms), Math.round(frames * FIXED_STEP_MS));
      lastSnapshot = snapshot;
      trace.push({
        step,
        mode: snapshot.mode,
        score: snapshot.score,
        clustersClearedCount: snapshot.clustersClearedCount,
        boostMeter: snapshot.boost.meter,
        pulseActive: snapshot.boost.active,
        pointer: targetPoint,
      });

      if (snapshot.mode === 'running' && snapshot.clustersClearedCount <= 2 && openingFrameIndex < 7) {
        await captureFrame(page, openingFrames, openingFrameIndex);
        openingFrameIndex += 1;
      }

      if (snapshot.mode === 'running' && snapshot.boost.active && snapshot.clustersClearedCount >= 2 && boostFrameIndex < 7) {
        await captureFrame(page, boostFrames, boostFrameIndex);
        boostFrameIndex += 1;
      }

      if (snapshot.mode === 'running' && snapshot.clustersClearedCount >= 5 && finishFrameIndex < 7) {
        await captureFrame(page, finishFrames, finishFrameIndex);
        finishFrameIndex += 1;
      }

      if (!openingShotDone && snapshot.clustersClearedCount >= 1) {
        await page.screenshot({ path: path.join(outDir, 'shot-1-arena-opening.png'), fullPage: true });
        writeJson('state-1-arena-opening.json', snapshot);
        openingShotDone = true;
      }

      if (!boostShotDone && snapshot.boost.active && snapshot.clustersClearedCount >= 2) {
        await page.screenshot({ path: path.join(outDir, 'shot-2-boost-corridor.png'), fullPage: true });
        writeJson('state-2-boost-corridor.json', snapshot);
        boostShotDone = true;
      }

      if (!pauseShotDone && snapshot.mode === 'running' && snapshot.clustersClearedCount >= 3) {
        const beforePause = snapshot;
        await syncButtons(page, ['p']);
        actionSteps.push({
          buttons: ['p'],
          mouse_x: pagePoint.x,
          mouse_y: pagePoint.y,
          frames: 12,
        });
        snapshot = await page.evaluate((ms) => window.advanceTime(ms), Math.round(12 * FIXED_STEP_MS));
        lastSnapshot = snapshot;
        const afterPause = await getState(page);
        await page.screenshot({ path: path.join(outDir, 'shot-3-paused.png'), fullPage: true });
        writeJson('state-3-paused.json', {
          before: beforePause,
          after: afterPause,
        });
        await syncButtons(page, []);
        await syncButtons(page, ['p']);
        snapshot = await page.evaluate((ms) => window.advanceTime(ms), Math.round(2 * FIXED_STEP_MS));
        lastSnapshot = snapshot;
        pauseShotDone = true;
        continue;
      }

      if (snapshot.mode === 'finished' || snapshot.mode === 'crashed') {
        break;
      }
    }

    await releaseHeldKeys(page);

    snapshot = await getState(page);
    lastSnapshot = snapshot;
    if (snapshot.mode !== 'finished') {
      throw new Error(`capture route ended in unexpected mode: ${snapshot.mode}`);
    }

    await page.screenshot({ path: path.join(outDir, 'shot-4-finish-banner.png'), fullPage: true });
    writeJson('state-4-finish-banner.json', snapshot);
    await captureFrame(page, finishFrames, Math.min(finishFrameIndex, 7));

    await page.keyboard.press('KeyR');
    actionSteps.push({
      buttons: ['r'],
      mouse_x: Math.round(box.x + box.width / 2),
      mouse_y: Math.round(box.y + box.height / 2),
      frames: 2,
    });
    await page.evaluate((ms) => window.advanceTime(ms), Math.round(2 * FIXED_STEP_MS));
    const resetSnapshot = await getState(page);
    lastSnapshot = resetSnapshot;
    await page.screenshot({ path: path.join(outDir, 'shot-5-reset-title.png'), fullPage: true });
    writeJson('state-5-reset-title.json', resetSnapshot);

    writeJson('action_payload.json', { steps: actionSteps });
    writeJson('trace.json', trace);
    writeFileSync(path.join(outDir, 'browser-log.txt'), `${browserLogs.join('\n')}\n`, 'utf8');
    writeFileSync(path.join(outDir, 'server-log.txt'), `${serverLogs.join('')}\n`, 'utf8');

    createGif(openingFrames, path.join(gifDir, 'clip-01-arena-opening.gif'));
    createGif(boostFrames, path.join(gifDir, 'clip-02-boost-corridor.gif'));
    createGif(finishFrames, path.join(gifDir, 'clip-03-finish-banner.gif'));
  } catch (error) {
    if (actionSteps.length > 0) {
      writeJson('action_payload.partial.json', { steps: actionSteps });
    }
    if (trace.length > 0) {
      writeJson('trace.partial.json', trace);
    }
    if (lastSnapshot) {
      writeJson('state-last.json', lastSnapshot);
    }
    if (browserLogs.length > 0) {
      writeFileSync(path.join(outDir, 'browser-log.txt'), `${browserLogs.join('\n')}\n`, 'utf8');
    }
    if (serverLogs.length > 0) {
      writeFileSync(path.join(outDir, 'server-log.txt'), `${serverLogs.join('')}\n`, 'utf8');
    }
    writeFileSync(path.join(outDir, 'capture-error.txt'), `${error.stack || error}\n`, 'utf8');
    throw error;
  } finally {
    try {
      if (browser) {
        await browser.close();
      }
    } finally {
      server.kill('SIGTERM');
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
