# Ken.AI — Claude Fable 5.2 edition

Served at `/games/kenai/claude_fable_5_2/game.html`. Static files, no images, no sound.

## The idea

The Grokbot edition is a care game: bars drain in real time and you tap to top them up. This edition asks a different question of the same life: what did the years go to? Ken's whole life, 2026 to whenever it ends, is about forty decisions.

- **A turn is a few years.** Three cards say what those years could go to. Pick one.
- **The times interrupt.** Each stage has an era (talking toys, personal tutors, agents everywhere, and on) and its own dilemmas.
- **Five threads:** health, joy, bonds, craft and means. Every card pulls some up and lets others slip. All fray a little each year; bonds fray fastest.
- **The band.** His life is woven as he lives it, one column per year, each thread as wide as it is strong, with a knot where something worth remembering happened.
- **The ending is written from what happened.** Notable choices leave a clause ("built a robot from cardboard at nine"), and the epitaph is assembled from them, from what he wanted, and from how much he leaned on machines.

## Rules

Nine stages from baby to elder; turns are 1 to 5 years long. Health falls faster with age. Low means, low bonds or low joy drag other threads down. Ken dies if health reaches zero, or from sixty on by a yearly chance that rises with age and falls with health; nobody passes 104.

Score = joy and bonds averaged over a full 85-year span (so a short life counts for less) + best craft + years lived + things worth remembering + how close he came to what he wanted. Tests check that a tended life reliably outscores a random one, and a random one a careless one.

## Content

65 cards and 24 events in `story.js`, with effects, flags (a best friend, a partner, a child, a company) that unlock later cards, and the clauses for the epitaph. It is speculative fiction, says so on the first screen, and is written to be gentle.

## Saving

A life is determined by its seed and its list of picks, so a life in progress is saved as exactly that in `localStorage` and rebuilt by replaying it.

## Files

`story.js` (content), `life.js` (rules, scoring, epitaph, save and restore; no DOM), `records.js`, `game.js`, `game.css`, `game.html`. Shared: `/js/fable/kit.js`, `/css/fable.css`. Font: Bricolage Grotesque, self-hosted under the SIL Open Font License.

## Records

Device records are in `localStorage`; on `whatthe.ai` the game writes to `leaderboard_kenai_claude_fable_5_2_v1` and `globalStats/stats_kenai_claude_fable_5_2_v1`. Scores are client-reported. If the Firestore rules do not allow the collection, device records still work and the last screen says so.

## Checks

`node --test tests/kenai_claude.test.mjs`: content shape and gating, determinism, the offer each turn, weaving, mortality, that choices matter, ambitions and epitaphs, save and restore, records and page wiring.
