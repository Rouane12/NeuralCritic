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
- Fully drafted roadmap pieces: **14**.
- Current roadmap mix: 16 Guides, 11 Reviews, 8 What to Play pages and 6 Features.
- Draft-creation phase is complete. Default work is now research → full article → metadata → imagery → internal links → QA → publication.

## Fully drafted roadmap pieces

### Elden Ring / FromSoftware
1. `elden-ring-best-starting-classes-beginners` — **Elden Ring Best Starting Class for Beginners: All 12 Classes Explained**
2. `elden-ring-stats-soft-caps-explained` — **Elden Ring Stats and Soft Caps Explained: Vigor, Mind, Endurance and More**
3. `elden-ring-early-progression-what-to-upgrade-first` — **Elden Ring Early Game Progression Guide: What to Upgrade First**
4. `dark-souls-remastered-beginners-guide` — **Dark Souls Remastered Beginner’s Guide: What to Know Before Lordran**

### Baldur’s Gate 3
5. `baldurs-gate-3-best-classes-beginners` — **Baldur’s Gate 3 Best Classes for Beginners: Which Class Should You Pick?**
6. `baldurs-gate-3-companions-guide` — **Baldur’s Gate 3 Companions Guide: Who to Recruit and What They Do**
7. `baldurs-gate-3-difficulty-modes-explained` — **Baldur’s Gate 3 Difficulty Modes Explained: Which Should You Choose?**

### Cyberpunk 2077
8. `cyberpunk-2077-life-paths-explained` — **Cyberpunk 2077 Life Paths Explained: Corpo, Nomad or Streetkid?**
9. `cyberpunk-2077-best-attributes-perks-beginners` — **Cyberpunk 2077 Best Attributes and Perks for Beginners**

### Batch 3 guides
10. `red-dead-redemption-2-beginners-guide` — **Red Dead Redemption 2 Beginner’s Guide: What to Do First**
11. `tears-of-the-kingdom-best-early-armor-upgrades` — **Tears of the Kingdom Best Early Armor and Upgrades**
12. `breath-of-the-wild-best-early-armor-upgrades` — **Breath of the Wild Best Early Armor and Essential Upgrades**
13. `super-mario-odyssey-power-moons-explained` — **Super Mario Odyssey Power Moons Explained: How Many You Need and What They Unlock**
14. `mario-kart-8-deluxe-200cc-guide` — **Mario Kart 8 Deluxe 200cc Guide: Braking, Drifting and Kart Setup**

All 14 remain `draft` in Supabase. They still require image packages, internal-link passes, final factual/SEO QA and publication verification before going live.

## Review work

- `cyberpunk-2077-review` has a current-state editorial/research scaffold but no score or verdict.
- `sekiro-shadows-die-twice-review`, `bloodborne-review`, `dark-souls-iii-review`, `dark-souls-remastered-review`, `god-of-war-ragnarok-review`, `persona-5-royal-review`, `ghost-of-tsushima-directors-cut-review`, `hades-review`, and `clair-obscur-expedition-33-review` remain neutral review shells.
- Review/scoring work only proceeds when tested-platform editorial judgment is available.

## Witcher 3 hold

The following drafts must be re-verified against the September 29, 2026 Remastered release before final production/publishing:

- `the-witcher-3-wild-hunt-review`
- `the-witcher-3-beginners-guide`
- `the-witcher-3-best-skills-abilities`
- `witcher-3-side-quests-standard`

## Remaining What to Play drafts

- `best-soulslike-games` — **The 12 Best Soulslike Games**
- `best-games-like-elden-ring` — **The 10 Best Games Like Elden Ring**
- `best-games-like-baldurs-gate-3` — **The 10 Best Games Like Baldur’s Gate 3**
- `best-story-driven-games` — **The 12 Best Story-Driven Games**
- `best-action-rpgs` — **The 12 Best Action RPGs**
- `best-3d-platformers` — **The 12 Best 3D Platformers**
- `best-games-under-20-hours` — **The 10 Best Games You Can Finish in Under 20 Hours**
- `best-turn-based-rpgs` — **The 12 Best Turn-Based RPGs**

## Remaining Feature drafts

- `baldurs-gate-3-companions-player-choice`
- `red-dead-redemption-2-world-feels-alive`
- `super-mario-galaxy-gravity-mechanics`
- `fromsoftware-boss-fights-memorable`
- `hades-failure-feels-like-progress`
- `witcher-3-side-quests-standard` — held for Remastered verification

## Next production order

1. Evaluate the eight timeless What to Play drafts against current search opportunity and existing Neural Critic internal-link coverage.
2. Fully draft the strongest first What to Play batch, prioritizing the FromSoftware/Elden Ring and Baldur’s Gate 3 clusters if search intent supports them.
3. Produce Features around clusters already supported by reviews, guides and Game Hubs.
4. Keep review shells separate until tested-platform editorial judgment is available.
5. Revisit Witcher 3 work after Remastered verification.

## Game Hub expansion already created

Roadmap Game Hubs added in Supabase: `sekiro-shadows-die-twice`, `bloodborne`, `dark-souls-iii`, `god-of-war-ragnarok`, `persona-5-royal`, `ghost-of-tsushima-directors-cut`, `hades`, `clair-obscur-expedition-33`.

Verify canonical generated pages during normal publication/deployment work before relying on them publicly.

## News lane

News remains outside the fixed evergreen quota. Publish meaningful timely stories when they have real reader/search value, especially when they strengthen an existing game, series or franchise cluster.
