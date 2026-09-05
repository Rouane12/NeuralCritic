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
- Never fabricate image provenance. Leave an image unset when the available asset cannot be credited confidently.

## Current milestone state

- Published library: **59 stories**.
- First library milestone: about **100 strong published stories**.
- Evergreen roadmap: **41 additional stories**.
- Roadmap draft records created: **41 of 41 — COMPLETE**.
- Total CMS drafts: **42**, including the separate `2026-video-game-release-calendar` draft.
- Fully drafted roadmap pieces: **27 of 41**.
- Remaining roadmap pieces needing full editorial completion: **14**, all gated by review judgment or Witcher 3 Remastered verification.
- Fully pre-publication-ready roadmap pieces: **21**.
- Readiness-complete except for future Witcher 3 re-verification: **2**.
- Asset/network blockers after editorial readiness work: **4**.
- No roadmap draft has been published during this production phase.

## Readiness census — 27 fully drafted pieces

### Fully pre-publication ready — 21

These have completed the current factual/metadata pass, provenance-safe feature imagery, canonical internal-link pass and Supabase re-query, and remain `status='draft'` with `published_at=NULL`.

#### Elden Ring / FromSoftware
- `elden-ring-best-starting-classes-beginners`
- `elden-ring-stats-soft-caps-explained`
- `elden-ring-early-progression-what-to-upgrade-first`
- `best-soulslike-games`
- `best-games-like-elden-ring`
- `fromsoftware-boss-fights-memorable`

#### Baldur’s Gate 3
- `baldurs-gate-3-best-classes-beginners`
- `baldurs-gate-3-companions-guide`
- `baldurs-gate-3-difficulty-modes-explained`
- `best-games-like-baldurs-gate-3`
- `best-turn-based-rpgs`
- `baldurs-gate-3-companions-player-choice`

#### Nintendo / Zelda / Mario
- `tears-of-the-kingdom-best-early-armor-upgrades`
- `breath-of-the-wild-best-early-armor-upgrades`
- `super-mario-odyssey-power-moons-explained`
- `mario-kart-8-deluxe-200cc-guide`
- `best-3d-platformers`
- `best-games-under-20-hours`
- `super-mario-galaxy-gravity-mechanics`

#### Red Dead Redemption 2
- `red-dead-redemption-2-beginners-guide`
- `red-dead-redemption-2-world-feels-alive`

### Future factual recheck required — 2

The image/link/metadata readiness work is complete, but these pages include The Witcher 3 and must be re-verified after **The Witcher 3: Wild Hunt — Remastered** launches on September 29, 2026:

- `best-action-rpgs`
- `best-story-driven-games`

Do not publish these before that recheck.

### Asset / recirculation blockers — 4

Editorial copy, metadata and current factual work are complete, but the following are not yet fully pre-publication ready because Neural Critic does not currently have a safely reusable, verified-credit feature asset in the CMS for the page:

- `cyberpunk-2077-life-paths-explained`
- `cyberpunk-2077-best-attributes-perks-beginners`
- `dark-souls-remastered-beginners-guide`
- `hades-failure-feels-like-progress`

Additional notes:
- Cyberpunk 2077’s existing published beginner-guide image has no recorded credit, so it was deliberately not propagated. The two new Cyberpunk guides did receive their current-state factual pass, Mac platform metadata correction and canonical story links.
- Dark Souls Remastered has an existing local editorial image without recorded credit. Do not infer provenance from the game title or file name.
- Hades currently lacks a verified-credit CMS image and also lacks a safe published Hades story target for a manual internal link. Game Graph recirculation may cover this later, but do not rely on a generated Game Hub publicly until its canonical production page is verified.

## Readiness work completed on 2026-09-05

### Cyberpunk 2077
- Verified Patch 2.31 remains the latest general game patch; the April 2026 PlayStation 5 Pro update is platform-specific.
- Confirmed Update 2.0’s modern perk/attribute structure still underpins the guides.
- Corrected platform metadata to include Mac alongside PC, PlayStation, Xbox and Nintendo.
- Added canonical links between the two new guides and the already-published Cyberpunk beginner guide.
- Left feature imagery unset because no verified-credit reusable Cyberpunk asset exists in the CMS.

### Remaining Guides
Completed image/link/metadata readiness work for:
- `red-dead-redemption-2-beginners-guide`
- `tears-of-the-kingdom-best-early-armor-upgrades`
- `breath-of-the-wild-best-early-armor-upgrades`
- `super-mario-odyssey-power-moons-explained`
- `mario-kart-8-deluxe-200cc-guide`

Current Nintendo checks confirm the Breath of the Wild and Tears of the Kingdom Nintendo Switch 2 Editions are live, while Super Mario Odyssey remains supported on Switch 2 with behavior consistent with Switch.

Dark Souls Remastered received its canonical internal-link pass but remains asset-blocked for provenance.

### What to Play
All eight roadmap What to Play drafts now have representative feature imagery with recorded provenance and canonical internal links:
- `best-soulslike-games`
- `best-games-like-elden-ring`
- `best-games-like-baldurs-gate-3`
- `best-turn-based-rpgs`
- `best-action-rpgs`
- `best-story-driven-games`
- `best-3d-platformers`
- `best-games-under-20-hours`

`best-action-rpgs` and `best-story-driven-games` remain held only for the September 29 Witcher 3 Remastered recheck.

### Features
Completed image/link/metadata readiness work for:
- `fromsoftware-boss-fights-memorable`
- `baldurs-gate-3-companions-player-choice`
- `red-dead-redemption-2-world-feels-alive`
- `super-mario-galaxy-gravity-mechanics`

`hades-failure-feels-like-progress` remains content-complete but asset/recirculation-blocked as described above.

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

The mass-drafting and broad readiness phases are now effectively complete for everything that can be responsibly completed from current verified material.

Next default work:
1. Resolve the four asset/network blockers when verified, reusable imagery or a safe published recirculation target becomes available.
2. If the user explicitly decides to publish, publish in controlled cluster batches rather than dumping all 21 ready pieces at once.
3. Start with the Elden Ring / FromSoftware cluster, then Baldur’s Gate 3, then Nintendo/Zelda/Mario and Red Dead Redemption 2, re-querying Supabase after each publication batch.
4. For every publication batch, verify production canonical `/stories/<slug>/` URLs, sitemap/discovery presence, metadata/social presentation and Game Hub recirculation where relevant.
5. Keep real news running in parallel when it has genuine reader/search value.
6. Keep review shells gated until real tested-platform editorial judgment is available.
7. Revisit all Witcher 3-held work after September 29, 2026.

## Game Hub expansion already created

Roadmap Game Hubs added in Supabase: `sekiro-shadows-die-twice`, `bloodborne`, `dark-souls-iii`, `god-of-war-ragnarok`, `persona-5-royal`, `ghost-of-tsushima-directors-cut`, `hades`, `clair-obscur-expedition-33`.

Verify canonical generated pages during normal publication/deployment work before relying on them publicly.

## News lane

News remains outside the fixed evergreen quota. Publish meaningful timely stories when they have real reader/search value, especially when they strengthen an existing game, series or franchise cluster.
