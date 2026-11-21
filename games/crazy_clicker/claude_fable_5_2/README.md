# Crazy Clicker — Claude Fable 5.2 edition

Served at `/games/crazy_clicker/claude_fable_5_2/game.html`. Static files, synthesised sound, no runtime downloads beyond the site's Firebase leaderboard on `whatthe.ai`.

## The idea

The series rule stays: two taps set a beat, and every later tap must land within ±50 ms of it. This edition asks what makes keeping a beat hard, and then does those things to you on purpose.

After eight beats with a helper click, the run becomes a show. Each act lasts eight beats, followed by four beats of rest with the click back.

| Act | What happens |
| --- | --- |
| On your own | The helper click stops. |
| Lights out | The screen goes black: no ring, no tape. |
| The other drummer | A loud click plays about 11% faster than your beat. It starts in sync and drifts away. |
| The room moves | The stage sways. |
| The lying ring | The ring closes about 14% too slowly, with a click to match. |
| Fireworks | Bangs and flashes at random moments. |
| Three against two | A click plays three notes for every two of your beats. |

After the seventh act they return in pairs, and the wrong tempos move further from yours.

## Details

- **Tempo:** 60 to 200 beats a minute (300 to 1000 ms between the first two taps). A second tap that comes too late becomes a new first tap.
- **Timing** is measured from your previous tap, as in the other editions, using the browser's event timestamps rather than the time the handler ran.
- **Spare misses:** eight hits in a row within ±16 ms earn one forgiven miss; you can hold two. A forgiven missed beat keeps the grid where it was.
- **The tape** at the bottom draws the last 26 taps: above the line is early, below is late. The result screen draws the whole run, shades the acts, and names where you rushed or dragged most.
- **Your taps are the drum.** Each tap plays a kick; dead-on hits add a bell.
- **Reduced motion** keeps the room still and removes flashes; those acts use a sound trick instead. Hiding the tab ends the run without recording it, because a hidden tab cannot keep time.

## Files

`engine.js` (timing rules, the act schedule, the summary; no DOM), `records.js`, `game.js`, `game.css`, `game.html`. Shared: `/js/fable/kit.js`, `/css/fable.css`. Fonts: Bungee and Hanken Grotesk, self-hosted under the SIL Open Font License.

## Records

Ranked by streak, then by smaller average miss. Device records are in `localStorage`; on `whatthe.ai` the game writes to `leaderboard_crazy_clicker_claude_fable_5_2_v1` and `globalStats/stats_crazy_clicker_claude_fable_5_2_v1`. Scores are client-reported. If the Firestore rules do not allow the collection, device records still work and the result screen says so.

## Checks

`node --test tests/crazy_clicker_claude.test.mjs`: tempo limits, the window, grading, spares, the act schedule over 2,000 beats, the summary, records and element wiring.
