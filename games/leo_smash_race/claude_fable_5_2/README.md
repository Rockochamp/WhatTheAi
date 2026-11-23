# Leos Smash Racer — Claude Fable 5.2 edition

Leo designed this game when he was four: race, boost, smash things, and a
colour cube before the start. This edition is built for a four-year-old to
play alone on a phone or tablet, and for an adult to enjoy for one more race.

## What is different here

- **A road into the screen.** The other editions are side-on and top-down.
  This one puts you behind the car, on a road made of flat slices that
  bends and rolls over hills.
- **Nothing can go wrong.** Every toy on the road is there to be driven
  through. There is no damage, no game over, and doing nothing at all still
  reaches the finish line. Driving well is what gets you from fourth to first.
- **Two big buttons.** Left and right, or a finger anywhere on the left or
  right half of the screen, or the arrow keys. Boost is one red button that
  pulses when it is full. There is a horn because there has to be.
- **A helper.** Switched on by default: the car drifts toward the next toy
  and stays on the road. Switched off, bends push harder, you can leave the
  road, and the rivals are a little faster.
- **The cube is three taps.** Only the three sides you can see ever turn,
  and the scramble is three turns, so a child can undo it. "Show me" makes
  the right side glow. Solving it fills the boost before the start.
- **No typing.** The racing name is picked from two short lists in the
  garage, so nothing a child types ends up anywhere and nothing unkind ends
  up on the board. Every finished race goes to the shared board by itself.
- **English and German**, chosen from the browser and switchable.

## Files

| File | What it does |
| --- | --- |
| `sim.js` | The race without drawing: roads built from a seed, the car, toys, chains, boost, seven rivals. Fixed step, no randomness during a race. |
| `cube.js` | The 2×2 colour cube: turns, scramble, shortest solution. |
| `render.js` | Draws the road, scenery, toys and cars on one canvas. |
| `game.js` | Garage, cube, buttons, sounds, finish screen, rankings, both languages. |
| `records.js` | Record format and checks. Local records in this browser; the shared board is the Firestore collection `leaderboard_leo_smash_race_claude_fable_5_2_v1`, used only on whatthe.ai. |

Tests: `node --test tests/leo_racer_claude.test.mjs`.

All drawing is done in code and all sounds are synthesised; there are no
image or audio files. The font is Fredoka (SIL Open Font Licence), served
from `/fonts`.
