# Banana Survivors — Claude Fable 5.2 edition: Peel Out

Served at `/games/BananaSurvivors/claude_fable_5_2/game.html`. Static files, code-drawn art, synthesised sound.

## The idea

The other editions give the banana guns or blades, and blood. This one gives it the only weapon a banana has ever really had.

- **Peels are thrown for you** at the nearest monkey. A monkey that takes one slides away from you.
- **A sliding monkey is a bowling ball.** It hurts and tips whoever it runs into, and they slide too, a little slower, up to the chain depth.
- **Pile-ups score.** Tumbles from one peel are counted together: 5 is a Domino, 10 a Strike, 18 a Pile-up, 30 a Bananageddon, each with a bonus, and later tumbles in a chain are worth more.
- **Palms matter.** Sliding into one is a hard crash and shakes coconuts down on the monkeys nearby.
- **Dash** makes you untouchable for a quarter of a second and bowls over anything you hit.
- **No blood.** Tumbled monkeys see stars and fly off the screen.

## The troop

| Who | From | What to know |
| --- | --- | --- |
| Monkey | start | Walks at you. |
| Little ones | 18 s | Fast, light, in packs. |
| Red band | 60 s | Keeps its distance and lobs coconuts. The red circle shows where. |
| Gorilla | 95 s | Heavy. Slides slowly but flattens a row. |
| The king | every 2 min | Cannot be tipped. Winds up, then charges in a straight line; running into a palm stuns him and hurts him. Beating him heals you and gives two upgrades. |

Health and damage rise with time. At most about 230 are on the field.

## Upgrades

Fourteen, each with a rank cap: throw faster, throw more, slide further, deeper chains, harder landings, bursting overripe peels, peels dropped behind you, more coconuts, speed, health, healing, pickup range, a quicker dash that leaves peels, and golden peels. When everything is capped, a level heals instead.

## Controls

WASD or arrows; hold the left mouse button to run toward the cursor; drag anywhere on a touch screen for a floating stick. Dash with Space, Shift, right-click, a second finger, the Dash button, or a gamepad button. 1–3 pick upgrades. P or Escape pauses; leaving the tab pauses too.

## Files

- `engine.js` — the whole simulation at fixed 1/60 s steps from one seed, plus the autopilot used by the title screen and the tests. No DOM.
- `renderer.js` — canvas drawing: a tiled ground, palms, and characters made of arcs and curves.
- `audio.js` — a marimba tune that thickens over time and the cartoon noises, capped per frame so a pile-up stays listenable.
- `records.js`, `game.js`, `game.css`, `game.html`.
- Shared: `/js/fable/kit.js`, `/css/fable.css`. Font: Fredoka, self-hosted under the SIL Open Font License.

## Records

Score is points from tumbles and pile-ups plus two per second survived. Device records are in `localStorage`; on `whatthe.ai` the game writes to `leaderboard_banana_survivors_claude_fable_5_2_v1` and `globalStats/stats_banana_survivors_claude_fable_5_2_v1`. Scores are client-reported. If the Firestore rules do not allow the collection, device records still work and the result screen says so.

## Checks

`node --test tests/banana_claude.test.mjs`: determinism, throws, chains and their depth limit, pile-up counting, palm crashes, the king, damage and safety windows, dashing, coconut warnings, levelling, every upgrade to its cap, crowd growth and cap over 200 simulated seconds, bot runs that always end, records and page wiring.
