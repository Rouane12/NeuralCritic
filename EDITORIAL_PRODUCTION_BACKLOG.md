# Neural Critic Editorial Production Backlog

Last updated: 2026-09-05

Supabase is the source of truth for article records and status. This file is the compact durable production queue for the current growth phase.

## Current phase

**Publication-readiness / controlled publishing.**

The evergreen roadmap drafting phase is complete: **41/41 roadmap articles were drafted**. On 2026-09-05, a full publication audit was run across the live Supabase drafts. The first **21 roadmap articles passed the publication gate and were published in four controlled batches**. The remaining roadmap pieces stay draft until their specific blockers are resolved.

Core publication gate:
`editorial edit → current factual check → feature image + literal alt + verified provenance → internal links → SEO/metadata QA → editor-only review fields where applicable → publish → Supabase verification → canonical/discovery verification`

Never fabricate image provenance. Never invent review scores, verdicts, pros/cons, tested-platform claims, review-copy disclosures, or first-hand play judgments.

## Roadmap state

- Evergreen roadmap: **41 articles**.
- Fully drafted: **41/41 — COMPLETE**.
- Published from roadmap: **21/41**.
- Remaining roadmap drafts: **20**.
- Separate non-roadmap CMS draft: `2026-video-game-release-calendar`.

### Published 2026-09-05 — 21

#### Elden Ring / FromSoftware — 6
- `elden-ring-best-starting-classes-beginners`
- `elden-ring-stats-soft-caps-explained`
- `elden-ring-early-progression-what-to-upgrade-first`
- `best-soulslike-games`
- `best-games-like-elden-ring`
- `fromsoftware-boss-fights-memorable`

#### Baldur’s Gate 3 — 6
- `baldurs-gate-3-best-classes-beginners`
- `baldurs-gate-3-companions-guide`
- `baldurs-gate-3-difficulty-modes-explained`
- `best-games-like-baldurs-gate-3`
- `best-turn-based-rpgs`
- `baldurs-gate-3-companions-player-choice`

#### Nintendo / Zelda / Mario — 7
- `breath-of-the-wild-best-early-armor-upgrades`
- `tears-of-the-kingdom-best-early-armor-upgrades`
- `super-mario-odyssey-power-moons-explained`
- `mario-kart-8-deluxe-200cc-guide`
- `best-3d-platformers`
- `best-games-under-20-hours`
- `super-mario-galaxy-gravity-mechanics`

#### Red Dead Redemption 2 — 2
- `red-dead-redemption-2-beginners-guide`
- `red-dead-redemption-2-world-feels-alive`

Supabase was re-queried after every batch. All 21 returned `status='published'`, non-null `published_at`, and retained feature image, image alt and recorded image credit.

## Remaining roadmap drafts — 20

### Review drafts — 11: editor-only fields still incomplete

Do **not** publish until each has a complete review package: score, verdict, pros, cons, tested platform, review-copy disclosure/scope, and genuine editor judgment. The current audit also found many review bodies still contain neutral scaffold wording that should be converted to final review prose during the editor pass.

- `bloodborne-review` — score present; verdict/pros/cons/tested platform/review copy missing; feature image missing.
- `cyberpunk-2077-review` — score present; verdict/pros/cons/tested platform/review copy missing; image alt/credit missing.
- `dark-souls-iii-review` — score present; verdict/pros/cons/tested platform/review copy missing; image alt/credit missing.
- `sekiro-shadows-die-twice-review` — score present; verdict/pros/cons/tested platform/review copy missing; image alt/credit missing.
- `the-witcher-3-wild-hunt-review` — score present; verdict/pros/cons/tested platform/review copy missing; Remastered hold; image alt/credit missing.
- `clair-obscur-expedition-33-review` — score and all other editor-only fields missing; image alt/credit missing.
- `dark-souls-remastered-review` — score and all other editor-only fields missing; image alt/credit missing.
- `ghost-of-tsushima-directors-cut-review` — score and all other editor-only fields missing; image alt/credit missing.
- `god-of-war-ragnarok-review` — score and all other editor-only fields missing; image alt/credit missing.
- `hades-review` — score and all other editor-only fields missing; image alt/credit missing.
- `persona-5-royal-review` — score and all other editor-only fields missing; image alt/credit missing.

### Image provenance / accessibility blockers — 4 non-review pieces

These have feature-image URLs but the CMS currently lacks literal alt text and verified image credit. Do not infer provenance from filenames.

- `cyberpunk-2077-life-paths-explained`
- `cyberpunk-2077-best-attributes-perks-beginners`
- `dark-souls-remastered-beginners-guide`
- `hades-failure-feels-like-progress`

### Witcher 3 Remastered hold — 4 roadmap pieces

The following contain explicit `[REMASTERED RECHECK]` / publication-hold material and must be re-verified after the September 29, 2026 Remastered release:

- `the-witcher-3-beginners-guide`
- `the-witcher-3-best-skills-abilities`
- `witcher-3-side-quests-standard`
- `the-witcher-3-wild-hunt-review`

The first three also currently lack image alt/credit; the review additionally requires the complete editor-only review package.

### What to Play post-Remastered hold — 2

- `best-action-rpgs` — contains The Witcher 3 and needs post-Remastered factual verification; audit also found all 12 ranked entries currently lack `imageLocal` section images.
- `best-story-driven-games` — contains The Witcher 3 and needs post-Remastered factual verification.

## Separate draft outside the 41-roadmap

- `2026-video-game-release-calendar` — remains draft and currently has no feature image/alt/credit. Treat it separately from the 41-roadmap milestone.

## Audit repairs completed before the first publication batch

- Restored quick-read blocks where manual editing had removed them from the Elden Ring and Baldur’s Gate 3 guides and several feature pieces.
- Restored canonical `/stories/<slug>/` internal links on the three new Baldur’s Gate 3 guides.
- Rechecked current Elden Ring, Baldur’s Gate 3, Nintendo and Red Dead Redemption 2 factual baselines before publication.
- Confirmed the 21 published pieces had complete title/description/body/sections/conclusion, feature image, literal alt text, recorded image credit, tags/platform metadata and no active publication-hold marker.

## Production verification

Database publication is verified for the 21 pieces. The repository’s `Refresh publication discovery files` workflow runs on a 15-minute schedule and rebuilds runtime fallback data, sitemap/RSS, canonical story shells, topic/game/author pages and reliability audits from published CMS state.

Do not call production/discovery verification complete until a post-publication refresh run succeeds and the generated story shells/sitemap are re-read.

## Next action

1. Verify the post-publication discovery refresh and Pages deployment for the 21 newly published articles.
2. Have the editor complete the missing review-only fields and image provenance/alt fields listed above.
3. Publish each newly unblocked batch only after a fresh audit.
4. Revisit all Witcher 3-sensitive work after September 29, 2026.

## News lane

News remains outside the fixed evergreen roadmap. Continue meaningful timely coverage when it has genuine reader/search value, especially when it strengthens an existing game, series or franchise cluster.
