# Crazy Clicker — Grok 4.6

Grok 4.6's take on Crazy Clicker, at `/games/crazy_clicker/grok_4_6/game.html`. Same two-tap lock as Gemini 2.5 Pro, with its own rings, Ember save, soundtrack, art, and leaderboard.

## What changed

- **The ring is the truth.** Collapsing beat rings show the takt coming home. Gemini plays blind; this version lets you read the pulse.
- **Perfect window ±16ms.** Hits inside it are style. Rank is still the streak.
- **Ember.** Five perfects in a row charge a one-hit save. Ember does not stack. Miss without it and the run ends.
- **Live Core soundtrack.** A low drone follows fever. Ghost clicks mark the beat you locked. No canned loop.
- Isolated device, session, and global boards (`crazy_clicker_grok_4_6_v1`). Gemini scores stay on Gemini.

## Play

Tap, click, or press Space. Two taps lock the beat (minimum 70ms). Hold ±50ms. P or Escape pauses. One life unless Ember is lit.

## Validation

```
node --test tests/crazy_clicker_grok.test.mjs
```
