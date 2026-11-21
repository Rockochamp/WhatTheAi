# Steve Jobs – Hammurabi — Claude Fable 5.2 edition

Served at `/games/steve_jobs_hammurabi/claude_fable_5_2/game.html`. Static files, no build step, no runtime downloads beyond the site's Firebase leaderboard on `whatthe.ai`.

## Same economy, three new ideas

The rules are the ones the Grok 3 and GPT-6 Astra editions use: 100 people, 4,000 bushels and 100 acres to start; land at 18 to 28 bushels an acre; one bushel of seed per acre; ten acres per person; harvests of 3 to 7 bushels an acre; the same hunger, arrival, departure, rat, river and plague numbers. The tests replay 400 reigns through the Astra engine with the same rolls and require identical results every year.

What this edition changes is everything around those numbers.

1. **A fixed fate.** All of a reign's luck (ten harvest yields, ten prices, every event roll) is drawn from one seed before year one. Decisions no longer change which random numbers come next, so two rulers can face exactly the same luck.
2. **The scribe.** A built-in advisor that looks ahead on expected values only; it never sees the fate. It will set a plan for you three times per reign and explain why. When the reign ends, the game rules the same fate again with the scribe's advice every year and shows you the difference.
3. **Today's fate.** One seed per UTC day for every player, with its own ranking. Because the luck is fixed, it can be replayed and learned.

## Interface

- **The mosaic.** The kingdom is drawn as three inlaid bands in lapis, shell, carnelian and gold: people, granary jars, fields and the river. Every figure, jar and plot stands for a counted amount, and the scale is printed when one symbol stands for more than one. The mosaic previews your plan while you move the sliders: sown plots show barley, and the jars show what would be left.
- **The decree.** Three sliders with number fields. They can only reach values the granary, the land and the people allow, so a plan cannot be invalid by accident.
- **The ledger.** Where the grain goes (land, seed, rations, kept), the harvest range, hunger against its breaking point, and the chance and size of new arrivals.
- **The chronicle.** One entry per year, built from what actually happened.

## Files

- `engine.js` — rules, fate, forecast, the scribe, chronicle text. No DOM.
- `frieze.js` — the SVG mosaic.
- `audio.js` — a synthesised lyre: melody, drone and event sounds.
- `records.js` — record shape, validation, ranking.
- `game.js`, `game.css`, `game.html` — the page.
- Shared: `/js/fable/kit.js`, `/css/fable.css`, and Fraunces from `/fonts` (SIL Open Font License).

## Records

Score is the population after the last resolved year. Ties rank reigns that used the scribe less above those that used it more. Device records are in `localStorage` (`fable_board_steve_jobs_hammurabi_claude_fable_5_2_v1`). On `whatthe.ai`:

- `leaderboard_steve_jobs_hammurabi_claude_fable_5_2_v1` — new-fate reigns.
- `leaderboard_steve_jobs_hammurabi_claude_fable_5_2_v1_daily` — daily reigns, filtered by `day`.
- `globalStats/stats_steve_jobs_hammurabi_claude_fable_5_2_v1` — reign counter.

Records carry both `score` and `finalPawns` (the field the site's other Hammurabi boards use). Scores are client-reported. If the Firestore rules do not allow these collections, the result screen says so and device records still work.

## Checks

`node --test tests/hammurabi_claude.test.mjs`: fate determinism and ranges, 3,000 budget comparisons and 400 full reigns against the Astra engine, input immutability, slider limits, hunger rules, scribe validity and strength, mosaic scaling, records and element wiring.
