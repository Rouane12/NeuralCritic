# Neural Critic Editorial Production Backlog

Last updated: 2026-09-05

Supabase is the source of truth for article status and editorial fields. This file is the compact durable production queue for the current growth phase.

## Current phase

**Evergreen publishing + remaining blocker cleanup.**

The 41-article evergreen roadmap drafting phase is complete. The initial 21 roadmap articles were published on 2026-09-05, followed by a controlled publication of 10 completed non-Witcher review drafts and `best-story-driven-games` on the same day.

Core publication gate:
`editorial edit → current factual check → feature image + alt + verified provenance → inline image alt/caption audit → internal links → SEO/metadata QA → publish → Supabase verification → canonical/discovery verification`

Never fabricate image provenance. Never invent first-hand play claims, tested-platform claims, review-copy disclosures, or unsupported subjective judgments.

## Roadmap state

- Evergreen roadmap: **41 articles**.
- Fully drafted: **41/41 — COMPLETE**.
- Published from roadmap: **32/41**.
- Remaining roadmap drafts: **9**.
- Separate non-roadmap CMS draft: `2026-video-game-release-calendar`.
- Live article census after `best-story-driven-games` publication: **91 published / 10 drafts**.

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

### Witcher 3 Remastered review hold — OWNER DECISION

`the-witcher-3-wild-hunt-review` remains **draft** and is intentionally being treated as the **September 29, 2026 Remastered review**, not as a separate classic-only review.

Owner confirmed on 2026-09-05 that the current draft should stay in this Remastered-review lane rather than being finished and published early as a review of the pre-Remastered version.

Until Remastered launches, keep the stable story/quest/worldbuilding material but do **not** finalize or publish the review. After September 29:
- re-test combat feel and animations;
- re-test movement and mount handling;
- verify the revamped skill/progression systems;
- verify visuals, performance and platform-specific behavior;
- record the exact tested platform/build;
- finalize verdict, pros and cons from the released Remastered product;
- remove all `[REMASTERED RECHECK]` markers;
- run full image/SEO/internal-link/publication QA;
- publish only after the released Remastered build is actually assessed.

Do not reinterpret this draft later as a classic-only review unless the owner explicitly changes this decision.

## What to Play milestone — `best-story-driven-games`

Published on 2026-09-05 after a fresh live audit.

Completed before publication:
- all **12 ranked entries** retain their drafted images;
- all **12 inline images** now have non-empty `imageAlt` and `caption` fields;
- feature image, feature alt and recorded credit were already complete and preserved;
- meta description tightened to **157 characters**;
- body now contains **4 internal story links**, including newly published Cyberpunk 2077 and God of War Ragnarök reviews;
- no Remastered hold language remains;
- the Witcher 3 entry was rechecked against CD PROJEKT RED’s August 25 Remastered announcement. The entry is about stable quest writing/narrative structure, while the announced September 29 Remastered changes concern visuals, performance, gameplay and platform support, so this narrative-focused list no longer needs the post-Remastered hold.

The inline image alts are conservative game-specific descriptions because the exact stored pixels were not available for direct visual inspection. Captions add ranking/editorial context rather than repeating the alt text.

Supabase verification returned `status='published'`, non-null `published_at`, and **0 missing inline alts / 0 missing inline captions**.

## Other remaining drafts

Live CMS still contains 10 drafts, including the held Witcher Remastered review and the separate release-calendar draft. Re-query Supabase before acting because imagery/metadata may be edited manually between sessions.

Witcher 3 Remastered-dependent guides/features remain held where their claims depend on gameplay, progression or technical changes. Narrative-only material can be cleared earlier only after a fresh factual review shows the September 29 changes do not affect the article’s argument.

## Publication-discovery verification

Supabase publication is verified for the 10 reviews and `best-story-driven-games`.

The repository’s `Refresh publication discovery files` workflow runs on a scheduled cadence and rebuilds runtime fallback data, sitemap/RSS, canonical story shells, game/topic/author pages and publication audits from published CMS state.

**Do not call canonical/discovery verification complete for a new publication until a post-publication refresh has created the generated story page/sitemap entry and the resulting Pages / Publication Health runs are verified successful.**

## Immediate next action

1. Verify the next post-publication canonical refresh includes the 10 new reviews and `best-story-driven-games`.
2. Re-query the remaining 10 drafts and prioritize the next genuinely publication-ready **non-Witcher** evergreen piece.
3. Leave `the-witcher-3-wild-hunt-review` untouched as the September 29 Remastered review until the released build can be re-tested.
4. Keep other version-sensitive Witcher 3 Remastered material held for the September 29 factual/re-test pass.
5. Continue the growth plan of roughly **3 evergreen pieces per week**, emphasizing cluster-deepening Guides, Reviews and high-intent What to Play coverage.

## Growth context

Current growth targets:
- roughly **55–65 evergreen articles within 3 months**;
- around **100 evergreen articles within 6 months**;
- six-month category target: **40–50 Guides, 25–30 Reviews, 20–25 What to Play, 10–12 Features**.

New evergreen work should deepen established clusters before broad expansion and should include deliberate internal recirculation.
