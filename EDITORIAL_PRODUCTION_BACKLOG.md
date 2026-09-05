# Neural Critic Editorial Production Backlog

Last updated: 2026-09-05

Supabase is the source of truth for article records and status. This file is the compact durable production queue for the current growth phase.

## Operating rules

- Prioritize cluster depth before broad category expansion.
- Keep timely news as a parallel lane.
- Verify current facts and search intent immediately before publication.
- Finalize review verdicts, scores, pros/cons, tested-platform notes and opinion-led headlines only after the editorial review is actually completed.
- Recommendation/list pages are maintained assets and need recurring freshness reviews.
- Prefer durable recommendation titles over unnecessary “Right Now” wording.
- Do not publish merely to hit a numeric target.

## Current milestone state

- Published library: **59 stories**.
- First library milestone: about **100 strong published stories**.
- Evergreen roadmap: **41 additional stories**.
- Roadmap draft records created: **41 of 41 — COMPLETE**.
- Total CMS drafts: **42**, including the separate `2026-video-game-release-calendar` draft.
- Fully drafted roadmap pieces: **27 of 41**.
- Remaining roadmap pieces needing full editorial completion: **14**, all gated by review judgment or Witcher 3 Remastered verification.
- Pre-publication-ready roadmap pieces: **6** — three Elden Ring guides + three Baldur’s Gate 3 guides.

## Fully drafted roadmap work — 27

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
- `best-soulslike-games`
- `best-games-like-elden-ring`
- `best-games-like-baldurs-gate-3`
- `best-turn-based-rpgs`
- `best-action-rpgs`
- `best-story-driven-games`
- `best-3d-platformers`
- `best-games-under-20-hours`

Editorial notes:
- `best-action-rpgs` contains a Witcher 3 entry and must be re-verified after the September 29, 2026 Remastered release.
- `best-games-under-20-hours` uses typical main-story / critical-path time rather than 100% completion time.
- All recommendation pages use durable titles and should receive freshness reviews after publication.

### Features — 5 complete
- `fromsoftware-boss-fights-memorable`
- `baldurs-gate-3-companions-player-choice`
- `red-dead-redemption-2-world-feels-alive`
- `super-mario-galaxy-gravity-mechanics`
- `hades-failure-feels-like-progress`

## Publish-readiness batch 1 — Elden Ring COMPLETE

Pre-publication ready:
1. `elden-ring-best-starting-classes-beginners`
2. `elden-ring-stats-soft-caps-explained`
3. `elden-ring-early-progression-what-to-upgrade-first`

Verified work:
- current 2026 factual pass;
- provenance-safe feature images and literal alt text;
- verified existing image credits;
- canonical `/stories/<slug>/` internal links across the cluster and to published Elden Ring coverage;
- metadata review and Supabase re-query;
- all remain `draft` with `published_at=NULL`.

Internal-link counts: 4 / 3 / 3 respectively.

## Publish-readiness batch 2 — Baldur’s Gate 3 COMPLETE

Pre-publication ready:
1. `baldurs-gate-3-best-classes-beginners`
2. `baldurs-gate-3-companions-guide`
3. `baldurs-gate-3-difficulty-modes-explained`

Verified work on 2026-09-05:
- current-state check against Larian’s Patch 8 / Hotfix 36 game state;
- Patch 8 remains the final major content patch; later work is small hotfix/bug-fix maintenance;
- feature images assigned only from Larian assets whose provenance was already recorded in Neural Critic’s CMS;
- literal alt text and existing verified credits assigned;
- canonical `/stories/<slug>/` links added across the three new guides plus the already-published BG3 beginner guide and review;
- companion wording tightened to distinguish the six recruitable Origin companions from four later recruitable companions;
- all three re-queried after the write;
- all remain `draft` with `published_at=NULL`.

Internal-link verification: **4 story links on each guide**.

No publication has been performed for either readiness batch.

## Remaining 14 roadmap pieces — editorial gates

### Witcher 3 — HOLD until Remastered verification
- `the-witcher-3-beginners-guide`
- `the-witcher-3-best-skills-abilities`
- `witcher-3-side-quests-standard`
- `the-witcher-3-wild-hunt-review`

The Witcher 3: Wild Hunt — Remastered is scheduled for September 29, 2026. Re-verify mechanics, progression, platforms, visuals and the reviewed version before finalizing these pieces.

### Reviews — tested-platform/editorial judgment required
- `cyberpunk-2077-review` — current-state research scaffold exists; no score or verdict.
- `sekiro-shadows-die-twice-review`
- `bloodborne-review`
- `dark-souls-iii-review`
- `dark-souls-remastered-review`
- `god-of-war-ragnarok-review`
- `persona-5-royal-review`
- `ghost-of-tsushima-directors-cut-review`
- `hades-review`
- `clair-obscur-expedition-33-review`

Do not invent first-hand impressions, tested-platform claims, scores, verdicts, pros/cons or review-copy details.

## Next production phase

Next default batch: **Cyberpunk 2077 publish-readiness**.

1. `cyberpunk-2077-life-paths-explained`
2. `cyberpunk-2077-best-attributes-perks-beginners`

For each: current factual pass → provenance-safe image package → canonical internal-link pass → metadata/SEO QA → Supabase re-query. Keep them as drafts unless the user explicitly decides to publish.

After Cyberpunk, move through the strongest What to Play and Feature drafts by cluster/search opportunity, then publish in controlled batches with production verification. Keep real news running in parallel. Keep review shells gated until real tested-platform editorial judgment is available. Revisit Witcher 3 after Remastered verification.

## Game Hub expansion already created

Roadmap Game Hubs added in Supabase: `sekiro-shadows-die-twice`, `bloodborne`, `dark-souls-iii`, `god-of-war-ragnarok`, `persona-5-royal`, `ghost-of-tsushima-directors-cut`, `hades`, `clair-obscur-expedition-33`.

Verify canonical generated pages during normal publication/deployment work before relying on them publicly.

## News lane

News remains outside the fixed evergreen quota. Publish meaningful timely stories when they have real reader/search value, especially when they strengthen an existing game, series or franchise cluster.
