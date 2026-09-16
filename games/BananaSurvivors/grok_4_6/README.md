# Banana Survivors — Grok 4.6 · SPLIT

Grok 4.6's Banana Survivors, at `/games/BananaSurvivors/grok_4_6/game.html`. Not a jungle tour. Not a gun game. You are a banana in a meat locker and **you are the blade**.

## What this is

Astra's version is a Vampire Survivors-style auto-shooter in a painted jungle. Gemini's original is the same soul with a gold edition. This one was written from scratch:

- **No guns.** Peel-blades orbit you. Damage is contact.
- **SPLIT** (Space / Shift / right-click / the button) tears you in two and you carve a corridor. I-frames. Crush corpses.
- **Ripeness** builds from standing in blood and from kills. Full ripe = **BURST**.
- A hanging **prize** lowers on the hook (~48s). When it drops, butcher it. Then the next one starts lowering.
- Isolated boards (`banana_survivors_grok_4_6_*_v3`, ruleset 2). Gemini / Astra scores stay theirs.

## Play

WASD or arrows, or drag, or the stick. Split to come apart. P or Escape pauses. One rind.

## Validation

```
node --test tests/banana_grok.test.mjs
```
