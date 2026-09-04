# Neural Critic Editorial Production Backlog

Last updated: 2026-09-04

Supabase is the source of truth for article records and status. This file is the compact durable production queue for the current growth phase.

## Operating rules

- Prioritize cluster depth before broad category expansion.
- Keep timely news as a parallel lane; do not let the evergreen backlog block meaningful current coverage.
- Verify current facts and search intent immediately before publication.
- Finalize review verdicts, scores, pros/cons, tested-platform notes and opinion-led headlines only after the editorial review is actually completed.
- Recommendation/list pages are maintained assets and should be reviewed for freshness on a recurring basis.
- Prefer durable recommendation titles over unnecessary "Right Now" wording.
- Do not publish drafts merely to hit a numeric content target.

## Current milestone state

- Published library: 59 stories.
- First library milestone: about 100 strong published stories.
- Evergreen roadmap: 41 additional stories.
- Roadmap draft records created: **41 of 41 — COMPLETE**.
- Total CMS drafts: **42**, including the separate `2026-video-game-release-calendar` draft.
- Fully drafted roadmap pieces: **22**.
- Current roadmap mix: 16 Guides, 11 Reviews, 8 What to Play pages and 6 Features.
- All 8 roadmap What to Play pages are now fully drafted.
- Default work is now: remaining Features → image/internal-link/QA production passes → publication, while review drafts remain gated by real tested-platform editorial judgment.

## Fully drafted roadmap pieces

### Guides — 14 complete
- `elden-ring-best-starting-classes-beginners`
- `elden-ring-stats-soft-caps-explained`
- `elden-ring-early-progression-what-to-upgrade-first`
- `dark-souls-remastered-beginners-guide`
- `baldurs-gate-3-best-classes-beginners`
- `baldurs-gate-3-companions-guide`
- `baldurs-gate-3-difficulty-modes-explained`
- `cyberpunk-2077-life-paths-explained`
- `cyberpunk-2077-best-attributes-perks-beginners`
- `red-dead-redemption-2-beginners-guide`
- `tears-of-the-kingdom-best-early-armor-upgrades`
- `breath-of-the-wild-best-early-armor-upgrades`
- `super-mario-odyssey-power-moons-explained`
- `mario-kart-8-deluxe-200cc-guide`

### What to Play — 8 complete
- `best-soulslike-games` — **The 12 Best Soulslike Games**
- `best-games-like-elden-ring` — **The 10 Best Games Like Elden Ring**
- `best-games-like-baldurs-gate-3` — **The 10 Best Games Like Baldur’s Gate 3**
- `best-turn-based-rpgs` — **The 12 Best Turn-Based RPGs**
- `best-action-rpgs` — **The 12 Best Action RPGs**
- `best-story-driven-games` — **The 12 Best Story-Driven Games**
- `best-3d-platformers` — **The 12 Best 3D Platformers**
- `best-games-under-20-hours` — **The 10 Best Games You Can Finish in Under 20 Hours**

Current What to Play editorial notes:
- Turn-based RPGs and action RPGs showed the clearest current 2026 search intent in the second batch.
- The under-20-hours article defines the threshold as typical main-story/critical-path time, not 100% completion time.
- `best-action-rpgs` includes The Witcher 3 and therefore must be re-verified against the September 29, 2026 Remastered release before publication.
- All recommendation pages use durable titles and should receive recurring freshness reviews after publication.

All 22 fully drafted roadmap pieces remain `draft` in Supabase. They still require image packages, internal-link passes, final factual/SEO QA and publication verification before going live.

## Remaining Feature drafts

Produce next, in this order unless fresh search/editorial evidence changes priority:
1. `fromsoftware-boss-fights-memorable` — **What Makes FromSoftware Boss Fights So Memorable?**
2. `baldurs-gate-3-companions-player-choice` — **Why Baldur’s Gate 3’s Companions Make Player Choice Feel Personal**
3. `red-dead-redemption-2-world-feels-alive` — **Why Red Dead Redemption 2’s World Still Feels Alive**
4. `super-mario-galaxy-gravity-mechanics` — **Why Super Mario Galaxy’s Gravity Mechanics Still Feel Brilliant**
5. `hades-failure-feels-like-progress` — **Why Hades Makes Failure Feel Like Progress**
6. `witcher-3-side-quests-standard` — **HOLD** for Remastered verification.

## Review work

- `cyberpunk-2077-review` has a current-state editorial/research scaffold but no score or verdict.
- `sekiro-shadows-die-twice-review`, `bloodborne-review`, `dark-souls-iii-review`, `dark-souls-remastered-review`, `god-of-war-ragnarok-review`, `persona-5-royal-review`, `ghost-of-tsushima-directors-cut-review`, `hades-review`, and `clair-obscur-expedition-33-review` remain neutral review shells.
- Review/scoring work only proceeds when tested-platform editorial judgment is available.

## Witcher 3 hold

Re-verify against the September 29, 2026 Remastered release before final production/publishing:
- `the-witcher-3-wild-hunt-review`
- `the-witcher-3-beginners-guide`
- `the-witcher-3-best-skills-abilities`
- `witcher-3-side-quests-standard`
- the Witcher 3 entry inside `best-action-rpgs`

## Next production phase

1. Fully draft the five non-Witcher Features, starting with FromSoftware and BG3.
2. Then begin publish-readiness passes on the strongest completed evergreen drafts: images → internal links → factual/SEO QA → publish → verify.
3. Keep review shells separate until real tested-platform editorial judgment is available.
4. Revisit Witcher 3 work after Remastered verification.

## Game Hub expansion already created

Roadmap Game Hubs added in Supabase: `sekiro-shadows-die-twice`, `bloodborne`, `dark-souls-iii`, `god-of-war-ragnarok`, `persona-5-royal`, `ghost-of-tsushima-directors-cut`, `hades`, `clair-obscur-expedition-33`.

Verify canonical generated pages during normal publication/deployment work before relying on them publicly.

## News lane

News remains outside the fixed evergreen quota. Publish meaningful timely stories when they have real reader/search value, especially when they strengthen an existing game, series or franchise cluster.
