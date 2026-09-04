# Neural Critic Editorial Production Backlog

Last updated: 2026-09-04

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
- Remaining roadmap pieces needing full editorial completion: **14**.
- Current roadmap mix: 16 Guides, 11 Reviews, 8 What to Play pages and 6 Features.
- First publication-readiness cluster: **3 Elden Ring guides complete and verified as drafts**.

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

The following three drafts completed the pre-publication pass on 2026-09-04:

1. `elden-ring-best-starting-classes-beginners`
2. `elden-ring-stats-soft-caps-explained`
3. `elden-ring-early-progression-what-to-upgrade-first`

Verified work:
- current factual pass completed against the current 2026 base-game state;
- feature images assigned only from assets with provenance already recorded in Neural Critic’s CMS;
- literal image alt text and existing verified credits preserved/assigned;
- canonical `/stories/<slug>/` internal links added across the Elden Ring cluster and to relevant already-published Elden Ring coverage;
- metadata reviewed;
- all three re-queried in Supabase after writes;
- all three remain `status='draft'` with `published_at=NULL`.

Internal-link verification after the write:
- starting-class guide: 4 story links;
- stats/soft-caps guide: 3 story links;
- early-progression guide: 3 story links.

No publication was performed. These three are now the first roadmap pieces at **pre-publication ready** status, pending the final publish/production-verification step.

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

Next default batch: **Baldur’s Gate 3 publish-readiness**.

1. `baldurs-gate-3-best-classes-beginners`
2. `baldurs-gate-3-companions-guide`
3. `baldurs-gate-3-difficulty-modes-explained`

For each: provenance-safe image package → canonical internal-link pass → metadata/factual/SEO QA → Supabase re-query. Keep them as drafts unless the user explicitly decides to publish.

After BG3, continue with Cyberpunk and the strongest adjacent discovery pages. Keep real news running in parallel when it has genuine reader/search value. Keep review shells gated until real tested-platform editorial judgment is available. Revisit Witcher 3 after Remastered verification.

## Game Hub expansion already created

Roadmap Game Hubs added in Supabase: `sekiro-shadows-die-twice`, `bloodborne`, `dark-souls-iii`, `god-of-war-ragnarok`, `persona-5-royal`, `ghost-of-tsushima-directors-cut`, `hades`, `clair-obscur-expedition-33`.

Verify canonical generated pages during normal publication/deployment work before relying on them publicly.

## News lane

News remains outside the fixed evergreen quota. Publish meaningful timely stories when they have real reader/search value, especially when they strengthen an existing game, series or franchise cluster.
