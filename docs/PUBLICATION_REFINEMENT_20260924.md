# Publication refinement — 24 September 2026

Approved scope: consistent review scores, initial loading, relevant search,
homepage freshness and density, and clearer article summaries/conclusions.

## Owners and observed journeys

| Journey | Existing owner extended | Observed problem | Regression proof |
| --- | --- | --- | --- |
| Home/search → public article index → rendered stories | `content-api.js` | Repeated CMS/index reads; static fallback starts after a 2.2 s timeout | Shared request and delayed-CMS tests |
| Review → Games directory → game hub | `content-api.js`, `review-intelligence.js`, `games-directory.js`, `game-page.js` | Missing catalog score becomes 0.0; published review score disagrees | Null/zero/invalid and linked-review fixtures |
| Search “Elden Ring” → hubs and stories | `discovery-intelligence.js`, `search-parity.js` | Unrelated entities gain relevance from story counts | Exact, unrelated, partial and empty-query fixtures |
| Home → lead/supporting stories → Latest | `discovery-intelligence.js`, `home-curation-guard.js`, `home-feed.js` | Old breaking/manual slots stay prominent indefinitely; only three feed items | Fixed-date freshness and slot fixtures |
| Article → introduction → reading map → ending | `article-extras.js`, `article-conclusion.js`, `article-layout-recovery.css` | Quick Read duplicates the deck; all conclusions say FINAL VERDICT; oversized opening | Summary fixtures, existing reading regressions, browser review |
| Home → article/header Home link | `navigation-canonical-hotfix.js`, `header-brand-mark.css` | Brand stylesheet was loaded only on the homepage | Existing navigation regressions and visual review |

The Elden Ring review's final section is explicitly stored in the CMS conclusion
field. Its text will be preserved; its presentation must not imply it is an
overall verdict. CMS article copy and score values remain the editorial source.

## Implementation contracts

- Extend the public content API, discovery engine, and existing renderers; no
  second routing, reading-map, auth, analytics, or persistence system.
- Start static and live article reads together. Prefer a live result when ready;
  a valid generated snapshot may render after a 350 ms grace period. If no static
  content exists, wait for the existing bounded live lookup. Deduplicate reads
  within a page and keep its displayed content stable. The generated snapshot is
  refreshed by the existing publication workflow; no localStorage content cache.
- Scores accept only finite numbers in [0, 10]. Missing values stay unscored.
  A matching published scored review takes precedence over catalog metadata.
- Breaking/developing promotion expires after 48 hours, using publication time
  (routine metadata updates do not renew it). Manual homepage slots expire after
  seven days; newer news and reviews fill open places.
- Quick Read uses distinct, authored quick-read items only. No synthesized
  editorial claims. Conclusion labels reflect the format, preserving all copy.
- Keep clean story routes, canonical metadata, signed-out gates, consent defaults,
  CMS access rules, and existing Reading Map navigation ownership.

## Verification matrix

| Area | Status | Evidence |
| --- | --- | --- |
| New deterministic regression contracts | PENDING | `scripts/test_publication_refinement.js` |
| Protected runtime / reader / article journeys | PENDING | Existing focused regression suites |
| Publication/build consistency | PENDING | Applicable repository audits |
| Signed-out desktop dark/light | PENDING | Branch preview if available |
| Mobile browser | BLOCKED | Browser controller has no viewport mutation |
| Authenticated persistence | N/A | No auth/persistence changes; no test identity used |
| Merge / production deployment | PENDING | Repository baseline forbids automatic merge |
