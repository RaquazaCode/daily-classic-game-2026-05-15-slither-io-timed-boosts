# daily-classic-game-2026-05-15-slither-io-timed-boosts

<p align="center"><strong>A deterministic Slither.io-inspired arena run where boost windows open on a fixed cadence, rival snakes patrol readable routes, and a proof-friendly finish lets automation verify growth, scoring, pause, reset, and collision rules.</strong></p>

<p align="center">
  <img src="artifacts/playwright/shot-1-arena-opening.png" width="48%" alt="Opening arena with the player snake collecting its first orb cluster" />
  <img src="artifacts/playwright/shot-4-finish-banner.png" width="48%" alt="Late run finish state with the snake extended across the arena" />
</p>

## Quick Start

```bash
pnpm install
pnpm test
pnpm build
pnpm capture
pnpm dev
```

## How To Play

- Press `Enter` or click `Start / Restart` to begin.
- Move the mouse to steer the snake head toward a target point.
- Hold `Space` for a timed speed boost when charge is available.
- Press `P` to pause and `R` to reset to the title state.

## Rules

- Clear all six orb clusters around the arena to finish the run.
- Rival snakes follow deterministic patrol loops and cause an instant wipe if you hit a rival body or the arena wall.
- Boosting increases speed but drains the shared meter; the meter only refills during visible pulse windows.
- Cluster clears completed while a pulse window is live award an extra pulse bonus.
- The route is deterministic, so the challenge is line quality and boost timing rather than random spawn variance.

## Scoring

- Each orb grants `84` plus a combo-scaled bonus capped at `+48`.
- Each cleared cluster grants `+160`.
- Clearing a cluster during an active pulse window grants an extra `+120`.
- The finish bonus starts at `320`, adds the remaining boost meter value times `2`, and adds `+70` per captured pulse bonus.

## Twist

`timed boosts`

Boost charge refills in visible pulses. Strong runs depend on spending speed bursts only when the refill window and the arena line up, rather than holding boost constantly.

## Verification

- `pnpm test`
- `pnpm build`
- `pnpm capture`
- Browser hooks:
  `window.advanceTime(ms)` advances the deterministic simulation.
  `window.render_game_to_text()` returns the current arena state as JSON text.
- Node self-check proof:
  finish `13.07s`, score `4954`, length `34`, `6/6` clusters, `24/24` orbs, `3` pulse bonuses.
- Browser capture proof:
  finish `13.71s`, score `4947`, finish bonus `723`, length `34`, `6/6` clusters, `24/24` orbs, `3` pulse bonuses.
- Pause proof:
  `artifacts/playwright/state-3-paused.json` shows elapsed time and head position frozen across the pause window.
- Action payload:
  `artifacts/playwright/action_payload.json` uses the required `buttons`, `mouse_x`, `mouse_y`, and `frames` schema.
- Screenshots:
  `artifacts/playwright/shot-0-title-start.png`
  `artifacts/playwright/shot-1-arena-opening.png`
  `artifacts/playwright/shot-2-boost-corridor.png`
  `artifacts/playwright/shot-3-paused.png`
  `artifacts/playwright/shot-4-finish-banner.png`
  `artifacts/playwright/shot-5-reset-title.png`

### GIF Captures

- `Arena opening`: `assets/gifs/clip-01-arena-opening.gif`
- `Boost corridor`: `assets/gifs/clip-02-boost-corridor.gif`
- `Finish banner`: `assets/gifs/clip-03-finish-banner.gif`

## Project Layout

```text
src/                 deterministic simulation, autopilot helper, and renderer
scripts/             self-check and Playwright capture entry points
tests/               Node-based simulation assertions
artifacts/playwright/ screenshots, state dumps, action payload, and logs
assets/gifs/         exported GIF clips for the README
docs/plans/          run-local implementation plan
```
