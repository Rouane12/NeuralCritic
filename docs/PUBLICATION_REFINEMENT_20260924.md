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
| New deterministic regression contracts | PASS | 10 behavioral cases in `scripts/test_publication_refinement.js` |
| Protected runtime / reader / article journeys | PASS | Existing runtime, reader, home/nav, game/completeness, article reading/journey, recirculation, navigation and Weekly Drop suites |
| Publication/build consistency | PASS | Reliability, runtime consistency, discovery, games directory, review intelligence, publication V2, site integrity and popularity audits |
| Automated browser layout | PASS | Existing GitHub browser smoke job: 8/8 route/viewport cases at 1440px and 390px; see evidence below |
| Manual desktop dark/light visual review | BLOCKED | Local preview returns `ERR_BLOCKED_BY_CLIENT`; commit preview stops at external-content confirmation |
| Manual mobile browser | BLOCKED | Interactive browser controller has no viewport mutation; CI geometry coverage is separate |
| Authenticated persistence | N/A | No auth/persistence changes; no test identity used |
| Merge / production deployment | NOT PERFORMED | Repository baseline forbids automatic merge; draft PR #101 |

## Saved result and verification evidence

- Pull request: https://github.com/Rouane12/NeuralCritic/pull/101
- Product commit: `998155b144da9a968d571aabd1d134d1838e2c37`.
- Product tree: `c10fbf2c716b3e9279067362db5da67094a9a3b0`; confirmed equal
  between the locally tested checkout and the GitHub commit.
- Publication Health: https://github.com/Rouane12/NeuralCritic/actions/runs/35948019309
- Browser smoke: https://github.com/Rouane12/NeuralCritic/actions/runs/35948019238
- All nine PR checks succeeded: Publication, Browser smoke, Article Reading
  Experience, Article Journey, Article Ending, Game Hub, Topic Hub, Navigation
  Hotfix, and Social preview QA.

The existing browser suite checked the home, category, search and Elden Ring game
routes, plus the Physint and Gen Atlas story routes at desktop and mobile widths.
It reported no page-wide overflow and valid article grid, rail, sidebar,
recirculation and newsletter geometry. It deliberately blocks external requests
(including fonts, Supabase SDK and analytics), so its success proves the generated
fallback path and geometry, not live-CMS behavior, custom-font fidelity, or a
human visual assessment. Its console records those intentionally blocked resources.

Manual preview attempted:
https://raw.githack.com/Rouane12/NeuralCritic/998155b144da9a968d571aabd1d134d1838e2c37/index.html
The service displays an external-content confirmation before opening the page.
That confirmation was not accepted. Visual approval remains pending; no production
deployment or CMS content edit has been made.

Most changed HTML files only refresh asset cache pins. Generated article text,
canonical URLs, structured data and publication membership were preserved.
