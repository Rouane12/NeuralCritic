# Neural Critic Editorial Production Backlog

Last updated: 2026-09-04

This file is the durable production queue for the current growth phase. Supabase remains the source of truth for article records and status; this document records sequencing and editorial intent so future work can resume without reconstructing the plan from chat.

## Operating rules

- Prioritize cluster depth before broad category expansion.
- Keep timely news as a parallel lane; do not let the evergreen backlog block meaningful current coverage.
- Finalize review verdicts, scores, pros/cons, tested-platform notes, and opinion-led headlines only after the editorial review is actually completed.
- Verify current facts and search intent immediately before publication.
- Recommendation/list pages are maintained assets and should be reviewed for freshness on a recurring basis.
- Do not publish drafts merely to hit a numeric content target.

## Current target

- Current published library at batch start: 59 stories.
- First library milestone: about 100 strong published stories.
- Priority mix: deepen Guides, Reviews, What to Play and Features while News continues opportunistically.
- Current cluster priority: Elden Ring / FromSoftware, with Cyberpunk 2077 and Baldur's Gate 3 immediately behind it.
- The Witcher 3 remains strategically important, but its review is held for the September 29, 2026 Remastered release so the article does not become stale immediately after publication.

## Batch 1 — ACTIVE

### Fully drafted in Supabase

1. `elden-ring-best-starting-classes-beginners`
   - Title: **Elden Ring Best Starting Class for Beginners: All 12 Classes Explained**
   - Status: draft
   - Notes: updated for the 2026 Heavy Knight and Idus Knight additions.

2. `elden-ring-stats-soft-caps-explained`
   - Title: **Elden Ring Stats and Soft Caps Explained: Vigor, Mind, Endurance and More**
   - Status: draft
   - Notes: emphasizes diminishing returns and avoids presenting soft caps as universal hard limits.

3. `elden-ring-early-progression-what-to-upgrade-first`
   - Title: **Elden Ring Early Game Progression Guide: What to Upgrade First**
   - Status: fully drafted
   - Notes: prioritizes survivability, recovery, a focused combat setup, exploration, Spirit Ashes and deliberate stat investment; avoids unnecessary overlap with the existing beginner guide.

### Research / editorial scaffold completed

4. `cyberpunk-2077-review`
   - Title: **Cyberpunk 2077 Review**
   - Status: draft with current-state review scaffold
   - Verified context: Update 2.0 rebuilt major core systems; Update 2.3 and Patch 2.31 continued revisions; current supported releases include PC, PS5, Xbox Series X|S, Nintendo Switch 2 and Apple-silicon Mac; a PS5 Pro update shipped April 8, 2026.
   - Rule: no score, verdict, pros/cons, tested-platform judgment, or opinion-led headline until editorial review is completed.

### Held for a dated product change

5. `the-witcher-3-wild-hunt-review`
   - Title: **The Witcher 3: Wild Hunt Review**
   - Status: draft shell / HOLD
   - Reason: **The Witcher 3: Wild Hunt — Remastered launches September 29, 2026** as a free upgrade on qualifying PC, PS5 and Xbox Series X|S versions, with a native Nintendo Switch 2 release and major visual/gameplay revisions. Publishing the review immediately before that release would create avoidable staleness.
   - Resume after Remastered can be tested and the review can name the tested platform/version.

### Draft shells created in Supabase

6. `sekiro-shadows-die-twice-review`
   - Title: **Sekiro: Shadows Die Twice Review**
   - Status: draft shell
   - Game Hub record created and linked.

7. `bloodborne-review`
   - Title: **Bloodborne Review**
   - Status: draft shell
   - Game Hub record created and linked.

8. `dark-souls-iii-review`
   - Title: **Dark Souls III Review**
   - Status: draft shell
   - Game Hub record created and linked.

## Newly created Game Hub records

- `sekiro-shadows-die-twice`
- `bloodborne`
- `dark-souls-iii`

These records exist in Supabase and are linked to their corresponding review drafts. Canonical generated pages should be verified as part of the normal publication/deployment workflow before any related review is published.

## Next production order

1. Editorially review and finish `cyberpunk-2077-review` once a tested platform/version is confirmed.
2. Build the FromSoftware review sequence: Sekiro → Bloodborne → Dark Souls III.
3. Start the Baldur's Gate 3 guide mini-cluster.
4. Expand Cyberpunk guide coverage.
5. Revisit `the-witcher-3-wild-hunt-review` after the September 29 Remastered launch, then expand Witcher guide coverage against the current version.
6. Add timeless What to Play pages, preferring durable titles over unnecessary "Right Now" phrasing.
7. Continue Features/analysis work around established clusters.

## News lane

News remains outside the fixed evergreen quota. Publish meaningful timely stories when they have real reader/search value, especially when they strengthen an existing game, series or franchise cluster.
