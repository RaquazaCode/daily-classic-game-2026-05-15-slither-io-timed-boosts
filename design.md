# Design Notes

## Concept

- Source inspiration: Slither.io
- Twist: `timed boosts`
- Format: finite deterministic arena climb instead of an endless multiplayer survival loop
- Goal: preserve the feeling of route-cutting, orb racing, and body avoidance while giving unattended automation a stable finish state

## Mechanics

- The player steers the snake head toward the live mouse target and can trigger short boost bursts with `Space`.
- Rival snakes patrol fixed loops and remain dangerous body obstacles throughout the run.
- Energy orb clusters grow the snake, raise score, and open safer lines through the arena.
- The run supports pause, reset, restart, fullscreen, `window.advanceTime(ms)`, and `window.render_game_to_text()`.

## Visual Direction

- Cream and jade framing around a saturated arena grid with coral rival routes and bright boost pulses.
- Large editorial copy on the left, compact tactical stage on the right, and live telemetry beneath.
- The player snake uses mint and cyan tones so the body remains readable during boosts and at higher length.

## Proof Route

- Verification should prove growth, at least one successful boost refill cycle, a paused state, and a clean finish.
- Capture set should cover title, opening orb route, mid-run boost corridor, paused state, finish banner, and reset state.
