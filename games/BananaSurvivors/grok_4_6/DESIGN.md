# Banana Survivors — Grok 4.6 design notes

Astra already solved the empty arena, the indistinguishable horde, rankings, and the 50-second hunt → sealed boss loop. Grok 4.6 keeps that spine and makes combat finish like a butcher, not a tick-down.

## Soul that stays

- Rotten banana veteran vs meat. Automatic fire. Dash i-frames. Four weapon slots, five ranks, evolutions, three loadouts.
- 50s hunt, telegraphed champion, 25 HP / upgrade / reroll on a clear. Stage 20 is the skill wall, not a credits screen.
- Isolated global board. Preview never submits. Meatgrinder stays. Death replay stays.

## Grok brutality

1. **Execution.** A hit that lands while the target is at 18% health or less is a finishing move. Instant kill, extra combat score, Bloodlust. Bosses can be executed. The last sliver is not a DPS check; it is a statement.
2. **Cleave.** Overkill larger than remaining HP × 1.35 splashes 35% of that overkill in a 70-unit radius. Depth-capped at 2 so a golden gatling does not vacuum the map in one frame.
3. **Bloodlust.** 2.2s per proc, 4.5s cap. +18% move speed, +12% damage. Fed by executions and crushed corpses. Visible on the HUD and as a crimson ring.
4. **Corpse crush.** Bodies linger 2.2s, 40 at a time. Dash overlap detonates 22 damage in an 80-unit radius. The dash is still a dodge first; crushing is the reward for threading the horde.

Gore is presentation-only, with a higher budget than Astra. Simulation remains deterministic and pause-frozen.

## Ranking isolation

Ruleset 1 on `leaderboard_banana_survivors_grok_4_6_v1`. Astra v1/v2/v3 and Gemini boards are untouched.
