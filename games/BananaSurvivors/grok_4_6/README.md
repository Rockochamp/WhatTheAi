# Banana Survivors · Grok 4.6

Grok 4.6's take on Banana Survivors, at `/games/BananaSurvivors/grok_4_6/game.html`. Same 50-second hunt → boss showdown as GPT-6 Astra, with executions, cleaving overkill, Bloodlust, and corpse-crush dashes. Isolated leaderboards. Own thumbnail and hangar art.

The Astra and Gemini 3 Pro originals remain in the homepage selector.

## What changed

- **Execute.** Hit a monster at 18% health or less and it dies immediately. Bonus score, a heavier gore burst, and Bloodlust.
- **Cleave.** Overkill that dwarfs remaining health splashes 35% of that overkill into nearby meat (radius 70, depth-capped).
- **Bloodlust.** Executions and crushed corpses feed a 2.2s rage, capped at 4.5s. +18% move speed, +12% damage.
- **Corpse crush.** Bodies linger 2.2 seconds (cap 40). Dash through one to detonate 22 damage in a radius of 80.
- Heavier gore budgets. Isolated device, session, and global boards (`banana_survivors_grok_4_6_v1`). Astra and Gemini scores stay put.

Weapons, loadouts, stage loop, dash i-frames, Meatgrinder, and death replay are the same soul.

## Play

- Move with WASD, arrows, held mouse steering, or a floating touch joystick.
- Dash with Space, Shift, right-click, or the separate touch button.
- Weapons fire automatically. Collect XP and pick one of three upgrades.
- Survive 50 seconds, then kill the champion to take the next stage.

## Validation

```
node --test tests/banana_grok.test.mjs
```
