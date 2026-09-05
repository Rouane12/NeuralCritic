# Neural Critic Editorial Production Backlog

Last updated: 2026-09-05

Supabase is the source of truth for article status and editorial fields. This file is the compact durable production queue for the current growth phase.

## Current phase

**Evergreen publishing + remaining blocker cleanup.**

The 41-article evergreen roadmap drafting phase is complete. The initial 21 roadmap articles were published on 2026-09-05, followed by a controlled publication of 10 completed non-Witcher review drafts on the same day.

Core publication gate:
`editorial edit → current factual check → feature image + alt + verified provenance → internal links → SEO/metadata QA → editor-approved review package + actual tested-platform/scope confirmation → publish → Supabase verification → canonical/discovery verification`

Never fabricate image provenance. Never invent first-hand play claims, tested-platform claims, review-copy disclosures, or unsupported subjective judgments.

## Roadmap state

- Evergreen roadmap: **41 articles**.
- Fully drafted: **41/41 — COMPLETE**.
- Published from roadmap: **31/41**.
- Remaining roadmap drafts: **10**.
- Separate non-roadmap CMS draft: `2026-video-game-release-calendar`.
- Live article census immediately after the review publication batch: **90 published / 11 drafts**.

## Review lane — 10 published, 1 held

### Published 2026-09-05

The following 10 reviews passed the final CMS readiness audit and were published in two controlled batches. Supabase was re-queried after each batch and returned `status='published'`, non-null `published_at`, feature-image metadata, tested-platform/access scope, score, verdict, pros and cons.

- `bloodborne-review` — **9.3** — PlayStation (PS4 version)
- `clair-obscur-expedition-33-review` — **9.5** — PC (Steam)
- `cyberpunk-2077-review` — **8.9** — PC (Steam)
- `dark-souls-iii-review` — **9.2** — PC (Steam)
- `dark-souls-remastered-review` — **9.0** — PC (Steam)
- `ghost-of-tsushima-directors-cut-review` — **9.0** — PC (Steam)
- `god-of-war-ragnarok-review` — **9.1** — PC (Steam)
- `hades-review` — **9.6** — PC (Steam)
- `persona-5-royal-review` — **9.5** — PC (Steam)
- `sekiro-shadows-die-twice-review` — **9.2** — PC (Steam)

Owner confirmed the games were personally accessed through Steam / appropriate console platforms and that the review feature images are official imagery. `reviewCopy` records the access route rather than claiming publisher-provided review code.

### Final review QA completed before publication

- all 10 have searchable review titles;
- meta descriptions are **151–158 characters**;
- all 10 have **4 Quick Read points** and **8 substantive content sections**;
- all 10 have non-empty conclusions;
- all 10 have author/category/review-format/tags/platform/game mapping;
- all 10 have feature images, non-empty alt text and recorded official-image credit;
- all 10 have score, verdict, pros, cons, tested platform and access scope;
- stale framework/future wording such as “the published review will…” was removed;
- Ghost of Tsushima Director’s Cut, God of War Ragnarök and Hades received game-page recirculation links so every review has an internal destination;
- the final factual pass used current primary sources for platform/release/package context.

Feature-image alt text is intentionally conservative because the exact stored image pixels were not available to the publication connector for visual inspection. It identifies the official game imagery without inventing scene-specific details. Improve these alts later if exact visual inspection becomes available.

### Witcher hold

`the-witcher-3-wild-hunt-review` remains **draft** and intentionally held until after **The Witcher 3: Wild Hunt — Remastered** launches on **September 29, 2026**. Its version-sensitive combat, progression and technical sections must be re-tested and reverified before verdict/pros/cons are finalized.

## Other remaining drafts

Live CMS still contains non-review drafts in addition to the held Witcher review. Re-query Supabase before acting because imagery/metadata may be edited manually between sessions.

Known future-sensitive material includes Witcher 3 Remastered-dependent guides/features/What to Play entries. Reverify after September 29 rather than carrying pre-Remastered assumptions forward.

## Publication-discovery verification

Supabase publication is verified for all 10 newly published reviews.

The repository’s `Refresh publication discovery files` workflow runs on a scheduled cadence and rebuilds runtime fallback data, sitemap/RSS, canonical story shells, game/topic/author pages and publication audits from published CMS state.

**Do not call canonical/discovery verification complete until a post-publication refresh has created the generated review pages/sitemap entries and the resulting Pages / Publication Health runs are verified successful.**

## Immediate next action

1. Verify the post-publication canonical refresh and Pages/Publication Health for the 10 new reviews.
2. Re-query the remaining 11 drafts and prioritize the non-Witcher evergreen pieces that are genuinely publication-ready.
3. Keep the Witcher 3 Remastered-dependent material held for the September 29 factual/re-test pass.
4. Continue the growth plan of roughly **3 evergreen pieces per week**, emphasizing cluster-deepening Guides, Reviews and high-intent What to Play coverage.

## Growth context

Current growth targets:
- roughly **55–65 evergreen articles within 3 months**;
- around **100 evergreen articles within 6 months**;
- six-month category target: **40–50 Guides, 25–30 Reviews, 20–25 What to Play, 10–12 Features**.

New evergreen work should deepen established clusters before broad expansion and should include deliberate internal recirculation.
