# Neural Critic Editorial Production Backlog

Last updated: 2026-09-05

Supabase is the source of truth for article status and editorial fields. This file is the compact durable production queue for the current growth phase.

## Current phase

**Review completion + controlled evergreen publishing.**

The 41-article evergreen roadmap drafting phase is complete. The first 21 roadmap articles were published on 2026-09-05 after a controlled readiness audit. The current editorial focus is finishing the 11 remaining review drafts without inventing editor-only judgments or image provenance.

Core publication gate:
`editorial edit → current factual check → feature image + literal alt + verified provenance → internal links → SEO/metadata QA → editor-only review fields where applicable → publish → Supabase verification → canonical/discovery verification`

Never fabricate image provenance. Never invent review scores, verdicts, pros/cons, tested-platform claims, review-copy disclosures, or first-hand play judgments.

## Roadmap state

- Evergreen roadmap: **41 articles**.
- Fully drafted: **41/41 — COMPLETE**.
- Published from roadmap: **21/41**.
- Remaining roadmap drafts: **20**.
- Separate non-roadmap CMS draft: `2026-video-game-release-calendar`.

## Current review lane — 11 drafts

### Structural copy cleanup — COMPLETE 2026-09-05

All 11 review drafts were re-audited in live Supabase.

Completed in this pass:
- all 11 now have **8 substantive content sections**;
- all 11 now have **4 quick-read points**;
- all 11 have finished descriptions and conclusions;
- neutral scaffold language such as “the final review should assess…” was removed from the 10 non-Witcher reviews;
- useful internal links were added where strong published cluster destinations already exist;
- Cyberpunk 2077 platform metadata was corrected to include the current Apple-silicon Mac version;
- The Witcher 3 retains explicit `[REMASTERED RECHECK — September 29, 2026]` markers because its combat, progression and technical baseline is changing.

### Editor-only blockers still open

Every review still requires genuine editorial completion before publication:
- verdict;
- pros;
- cons;
- tested platform;
- review-copy disclosure / scope;
- final first-hand editorial judgment.

Scores currently recorded in Supabase:
- `bloodborne-review` — **9.3**
- `cyberpunk-2077-review` — **8.9**
- `dark-souls-iii-review` — **9.2**
- `sekiro-shadows-die-twice-review` — **9.2**
- `the-witcher-3-wild-hunt-review` — **9.0**

Scores still empty:
- `clair-obscur-expedition-33-review`
- `dark-souls-remastered-review`
- `ghost-of-tsushima-directors-cut-review`
- `god-of-war-ragnarok-review`
- `hades-review`
- `persona-5-royal-review`

### Review image blockers

- `bloodborne-review` still has **no feature image**.
- The other 10 review drafts have feature-image URLs but currently lack **literal feature-image alt text** and **verified image credit** in Supabase.
- Do not infer credits from filenames, game names, developers or publishers.

### Witcher hold

`the-witcher-3-wild-hunt-review` remains held until after **The Witcher 3: Wild Hunt — Remastered** launches on **September 29, 2026** and its version-sensitive sections are re-tested and reverified.

## Published roadmap batch — 21

Published and previously verified:
- Elden Ring / FromSoftware: 6
- Baldur’s Gate 3: 6
- Nintendo / Zelda / Mario: 7
- Red Dead Redemption 2: 2

The post-publication canonical discovery refresh, sitemap generation and GitHub Pages deployment were subsequently verified successful.

## Other remaining drafts

Live CMS still contains non-review drafts in addition to the review lane. Before working on those, re-query Supabase because the owner is currently prioritizing Reviews and has been manually editing imagery/metadata.

Known future-sensitive material includes Witcher 3 Remastered-dependent Guides / Features / What to Play entries. Reverify after September 29 rather than carrying pre-Remastered assumptions forward.

## Immediate next action

1. Collect the editor-only review package for the 10 non-Witcher reviews: score where missing, verdict, pros, cons, tested platform, and review-copy disclosure/scope.
2. Add/verify feature-image metadata only from identifiable visuals and known provenance; obtain a Bloodborne feature image.
3. Run current factual verification on each newly complete review.
4. Publish the completed non-Witcher review batch in controlled groups and verify Supabase + canonical production output.
5. Hold The Witcher 3 review for the September 29 Remastered re-test.

## Growth context

The current growth roadmap targets roughly **3 evergreen pieces per week**, with Guides as the strongest search-led category and Reviews / What to Play as the main depth opportunities. New work should deepen existing clusters before broad expansion and should always include deliberate internal recirculation.
