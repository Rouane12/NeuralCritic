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
- Fully drafted roadmap pieces: **17**.
- Current roadmap mix: 16 Guides, 11 Reviews, 8 What to Play pages and 6 Features.
- Draft-creation phase is complete. Default work is now research → full article → metadata → imagery → internal links → QA → publication.

## Fully drafted roadmap pieces

### Elden Ring / FromSoftware
1. `elden-ring-best-starting-classes-beginners`
2. `elden-ring-stats-soft-caps-explained`
3. `elden-ring-early-progression-what-to-upgrade-first`
4. `dark-souls-remastered-beginners-guide`

### Baldur’s Gate 3
5. `baldurs-gate-3-best-classes-beginners`
6. `baldurs-gate-3-companions-guide`
7. `baldurs-gate-3-difficulty-modes-explained`

### Cyberpunk 2077
8. `cyberpunk-2077-life-paths-explained`
9. `cyberpunk-2077-best-attributes-perks-beginners`

### Other guides
10. `red-dead-redemption-2-beginners-guide`
11. `tears-of-the-kingdom-best-early-armor-upgrades`
12. `breath-of-the-wild-best-early-armor-upgrades`
13. `super-mario-odyssey-power-moons-explained`
14. `mario-kart-8-deluxe-200cc-guide`

### What to Play — Batch 1 complete
15. `best-soulslike-games` — **The 12 Best Soulslike Games**
   - Broad reader-facing definition includes the Soulsborne lineage plus games inspired by it.
   - Ranked around combat quality, exploration, progression, encounter/boss design and learning through difficulty.
16. `best-games-like-elden-ring` — **The 10 Best Games Like Elden Ring**
   - Deliberately broader than a duplicate Soulslike list: recommendations map to combat, builds, bosses, exploration and discovery.
17. `best-games-like-baldurs-gate-3` — **The 10 Best Games Like Baldur’s Gate 3**
   - Focuses on reactive CRPG design, companions, tactical combat, dialogue and player-authored solutions.

All 17 remain `draft` in Supabase. They still require image packages, internal-link passes, final factual/SEO QA and publication verification before going live.

## Remaining What to Play drafts

- `best-turn-based-rpgs` — **The 12 Best Turn-Based RPGs**
- `best-action-rpgs` — **The 12 Best Action RPGs**
- `best-story-driven-games` — **The 12 Best Story-Driven Games**
- `best-3d-platformers` — **The 12 Best 3D Platformers**
- `best-games-under-20-hours` — **The 10 Best Games You Can Finish in Under 20 Hours**

Current search-opportunity review supports producing turn-based RPGs and action RPGs before the broader/less cluster-specific lists. Re-check intent immediately before final publication.

## Review work

- `cyberpunk-2077-review` has a current-state editorial/research scaffold but no score or verdict.
- `sekiro-shadows-die-twice-review`, `bloodborne-review`, `dark-souls-iii-review`, `dark-souls-remastered-review`, `god-of-war-ragnarok-review`, `persona-5-royal-review`, `ghost-of-tsushima-directors-cut-review`, `hades-review`, and `clair-obscur-expedition-33-review` remain neutral review shells.
- Review/scoring work only proceeds when tested-platform editorial judgment is available.

## Remaining Feature drafts

- `baldurs-gate-3-companions-player-choice`
- `red-dead-redemption-2-world-feels-alive`
- `super-mario-galaxy-gravity-mechanics`
- `fromsoftware-boss-fights-memorable`
- `hades-failure-feels-like-progress`
- `witcher-3-side-quests-standard` — held for Remastered verification

## Witcher 3 hold

Re-verify against the September 29, 2026 Remastered release before final production/publishing:
- `the-witcher-3-wild-hunt-review`
- `the-witcher-3-beginners-guide`
- `the-witcher-3-best-skills-abilities`
- `witcher-3-side-quests-standard`

## Next production order

1. `best-turn-based-rpgs`
2. `best-action-rpgs`
3. `best-story-driven-games`
4. `best-3d-platformers`
5. `best-games-under-20-hours`
6. Produce Features around clusters already supported by reviews, guides and Game Hubs.
7. Keep review shells separate until tested-platform editorial judgment is available.
8. Revisit Witcher 3 work after Remastered verification.

## Game Hub expansion already created

Roadmap Game Hubs added in Supabase: `sekiro-shadows-die-twice`, `bloodborne`, `dark-souls-iii`, `god-of-war-ragnarok`, `persona-5-royal`, `ghost-of-tsushima-directors-cut`, `hades`, `clair-obscur-expedition-33`.

Verify canonical generated pages during normal publication/deployment work before relying on them publicly.

## News lane

News remains outside the fixed evergreen quota. Publish meaningful timely stories when they have real reader/search value, especially when they strengthen an existing game, series or franchise cluster.
