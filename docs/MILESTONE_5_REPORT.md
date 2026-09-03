# Neural Critic Overhaul — Milestone 5 Report

Date: 2026-09-03
Branch: `overhaul/baseline-regression-safety`
Product head before this report: `2f056e6531ec10a84804244e562754e101b83cf0`
Latest product commit before main reconciliation: `54e811238e510b514aa9003ba8c54fdd3264f489`
Reconciled `main`: `f0091da139c653d5af13e48573cfbaf2a0f20778`
Draft pull request: #54; not merged

Milestone 5 is the first visible reader-experience overhaul slice. It changes homepage and global-navigation presentation around the established publication owners. It does not replace Discovery Intelligence, Popularity Signals, search, Game Graph, newsletter, account, analytics, canonical routing, or publication systems, and it does not implement any of the six missing benchmark capabilities.

## A. Existing architecture reused

The milestone keeps the existing owners documented in `docs/MILESTONE_5_READER_HIERARCHY.md`:

- shared shell/theme/rendering: `assets/app.js`
- editorial lead/supporting selection: publication metadata, Discovery Intelligence, `assets/home-curation-guard.js`
- Latest/feed filters: `assets/home-feed.js`
- Trending/Most Read: `assets/popularity-signals.js`
- What to Play/curated collections: `assets/home-what-to-play.js`, `assets/curated-collections.js`
- publication navigation: `assets/publication-nav.js`, `assets/publication-nav.css`
- search: existing overlay/full search owners
- newsletter: existing `assets/newsletter.js` and public Edge capture path
- analytics: existing `assets/analytics.js` plus existing module events

No parallel feed, ranking, search, discovery, navigation, newsletter, or analytics engine was introduced.

## B. Reader hierarchy chosen

The accepted hierarchy is:

1. orient with six primary destinations: News, Reviews, Guides, Features, What to Play, Games;
2. one dominant programmed lead plus restrained supporting stories;
3. distinguish chronological Latest from Trending/Most Read popularity modes;
4. group Reviews and Guides as a service-oriented decision/help desk;
5. retain What to Play and Games/Game Graph paths for deeper exploration;
6. preserve canonical story/game/topic links so readers can continue through related coverage;
7. place newsletter acquisition after the page has established editorial value.

The intended paths remain:

`Homepage → Story → Game/Topic → Related Coverage → Next Story`

and

`Homepage → Reviews/Guides/What to Play → Story → Game Hub`

## C. Homepage changes

- Added scoped `assets/homepage-v2.css` rather than rewriting the global stylesheet stack.
- Preserved one programmed hero and supporting-story authority while strengthening scale, spacing, module boundaries, and service-card hierarchy.
- Clarified Latest coverage with explicit section copy and filter controls.
- Presented Trending/Most Read as a separate popularity lane instead of another undifferentiated card list.
- Grouped Reviews and Guides into a clearer service desk.
- Kept What to Play and conditional commerce under their existing owners.
- Preserved the existing newsletter capture form and backend path.
- Added explicit landmarks/headings rather than adding non-semantic visual wrappers only.

A browser canary exposed a fallback-only discovery defect where fallback Trending could repeat a lead or visible Latest story. The existing homepage/popularity owners were corrected so hero/feed slugs reserve adjacent slots before Trending/Most Read are rendered. No ranking algorithm was replaced.

A later interaction review found that feed filter buttons still emitted analytics without re-rendering the selected feed. `assets/home-feed.js` now calls its existing `renderFeed(nextFilter)` owner before emitting the existing analytics event.

The accumulated PR review then found a future-data edge case that the representative browser dataset did not expose: a newly published review, guide, or What to Play story could appear in the visible Latest feed and its service module at the same time. Before merge, the existing module owners were hardened to consume the visible feed slug set as well as hero/supporting slugs, and the homepage/navigation regression check was strengthened to enforce that cross-module contract. No ranking or content-selection engine was duplicated.

## D. Navigation changes

The global publication navigation now makes the six core reader destinations visibly primary while search, theme, and account remain utilities.

The existing disclosure owner remains in `assets/publication-nav.js`. CSS visibility was aligned with the explicit `.open` disclosure state rather than allowing hover/focus selectors to create competing menu visibility. No mega-menu or replacement navigation framework was introduced.

The navigation continues to use real crawlable links for publication destinations.

## E. Mobile behavior

The responsive contract is implemented and protected deterministically:

- homepage lead/content/features collapse to a single-column hierarchy;
- filter rows are intentionally horizontally scrollable rather than causing page-level overflow;
- What to Play entry points collapse to one column;
- mobile publication navigation uses its existing drawer/accordion owner;
- the drawer owns body scroll lock, constrained viewport height, internal scrolling, disclosure state, Escape handling, and touch-target minimums.

The available Work browser could not mutate its viewport. Therefore no real narrow/mobile browser claim is made for the final Milestone 5 branch. Mobile remains an explicit verification limitation rather than being promoted from CSS presence alone.

## F. Discovery and recirculation improvements

The milestone improves presentation and adjacency, not recommendation scoring.

- Programmed hero/supporting slugs are preserved.
- The visible feed publishes its current slug set through `window.NeuralCriticHomepageState`.
- Trending/Most Read consume the existing popularity engine but exclude hero/feed slugs when enough eligible alternatives exist.
- Reviews, Guides, and What to Play now also avoid the visible hero/feed slug set when eligible alternatives exist and re-evaluate when the visible feed changes.
- Review/guide/What to Play presentation continues to use existing editorial/discovery owners.
- The fallback Trending renderer follows the same adjacent-story de-duplication intent when live audience signals are unavailable.

The corrected browser canary reported zero story overlap between Hero, Latest, Trending, and the Reviews/Guides presentation in the representative dataset. The accumulated review added deterministic protection for the same intent across future Review, Guide, and What to Play feed combinations.

## G. Accessibility results

The milestone keeps the existing accessibility layer and adds/strengthens deterministic contracts for:

- explicit page landmarks and heading hierarchy;
- `aria-pressed` feed filter states;
- disclosure-driven navigation state;
- Escape behavior and focus-return ownership for navigation/search paths;
- mobile drawer touch targets and scroll behavior;
- existing light/dark and reduced-motion ownership.

During browser QA, theme switching exposed a scoped light-mode selector issue in the new homepage styles. `assets/homepage-v2.css` was corrected so the Reviews/Guides service desk receives the intended light palette only on the homepage surface.

The final Work session ended before a complete post-fix browser pass across every last interaction commit. Deterministic/CI evidence covers the final branch; no stronger browser claim is made than the browser observations actually completed.

## H. SEO and internal-link impact

Homepage canonical, title, description, organization/site schema, RSS link, and canonical story architecture remain unchanged in intent.

The overhaul favors real anchor destinations and preserves clean canonical story links through the existing helpers. No keyword-stuffed SEO block, hidden link surface, fake freshness marker, or alternate story URL system was added.

Search, sitemap, generated story/game/topic pages, and publication routing remain owned by their established systems.

## I. Analytics impact

Existing analytics remains authoritative. Milestone 5 extends the existing tracker only for the new homepage/navigation presentation where needed and preserves existing feed-filter/popularity/search/account instrumentation.

The feed-filter correction renders through `assets/home-feed.js` and then emits the existing `homepage_feed_filter` event; it does not create a second interaction owner.

No personal data or new analytics backend was introduced.

## J. Responsive and browser evidence

Work completed a real Chrome pass on a corrected immutable commit at `1363 × 936` before its Work usage limit interrupted the final QA cycle. That representative pass reported:

- page width `1348` against viewport `1363`, with no page-level overflow;
- one H1;
- all 13 homepage images loaded;
- six clear primary destinations;
- no duplicate script/style loading;
- zero story overlap among Hero, Latest, Trending, and Reviews/Guides in the representative state.

The same pass continued through pointer/keyboard/search/theme/module checks and exposed two real issues that were subsequently corrected: light-mode homepage selector precedence and disclosure visibility. A later code/interaction review corrected the feed-filter render path.

Because Work usage ended before a complete real-browser rerun of the final combined commit, the final branch relies on exact-commit CI plus deterministic homepage/navigation contracts for those last corrections. Mobile/tablet browser evidence remains unavailable.

## K. Capability changes

No 200-capability status or verification-level promotion is made by this report.

Reason: the final combined branch has strong deterministic and exact-commit CI evidence, but the final post-fix browser matrix was interrupted before completion. Existing complete rows remain complete where their prior evidence already justified that status; partial mobile/responsive/accessibility/popularity rows remain partial until their specific remaining evidence boundary is closed.

Authoritative counts therefore remain:

- `126` ✅ Complete and verified
- `68` 🟡 Partial / weaker / unverified
- `6` ❌ Missing
- `0` 🚫 Intentionally not required

The six missing capabilities remain untouched.

## L. Regression results

Exact product commit `54e811238e510b514aa9003ba8c54fdd3264f489` passed:

- Publication Health run `#412` / workflow run `33701989214`
- Social Preview QA run `#20` / workflow run `33701989227`

Publication Health included successful steps for:

- generated publication preparation;
- JavaScript parse checks;
- protected runtime contracts;
- reader baseline contracts;
- homepage/navigation contracts;
- live anonymous auth boundary;
- Commerce Price Intelligence;
- publication surface/baseline/ledger/parity/launch audits;
- Reader Auth, Newsroom source, Discovery, Popularity, Games, Reviews, Newsletter, Publication Reliability, runtime consistency, and domain portability.

Before report creation, current `main` had advanced by one generated-publication commit, `f0091da139c653d5af13e48573cfbaf2a0f20778`. Inspection showed that commit changes only the RSS `lastBuildDate`. The overhaul branch was reconciled through merge commit `2f056e6531ec10a84804244e562754e101b83cf0` without changing the Milestone 5 product tree.

That reconciled commit then passed:

- Publication Health run `#413` / workflow run `33703303729`
- Social Preview QA run `#21` / workflow run `33703303745`

The first final report commit passed Publication Health `#414` and Social Preview QA `#22`. During accumulated PR review, cross-module de-duplication was hardened in commits `a3358f8f3f7bc0ecf2cbff5cc5718b66a05bb3af`, `fd8e4552216b9693c95ade4af91688b9bc7379cd`, and `3eef0e90f9f341e1fc8a9abc9cd25ab3db96c8c7`; that review head passed Publication Health `#417` and Social Preview QA `#25`, including the strengthened homepage/navigation contract.

The report-update head `62712b9f36521a3bd9a98bf682d2bab9f210f080` then passed Publication Health `#418` and Social Preview QA `#26` with the full accumulated suite still green.

No merge to `main` had been performed at the time this report was finalized.

## M. Files changed in the Milestone 5 slice

Compared with the Milestone 4 report head, the reader-experience slice touches:

- `.github/workflows/publication-health.yml`
- `README.md`
- `assets/analytics.js`
- `assets/app.js`
- `assets/home-curation-guard.js`
- `assets/home-feed.js`
- `assets/home-what-to-play.js`
- `assets/homepage-v2.css`
- `assets/popularity-signals.js`
- `assets/publication-nav.css`
- `assets/publication-nav.js`
- `index.html`
- `scripts/test_home_navigation.js`
- `docs/MILESTONE_5_READER_HIERARCHY.md`

The branch also contains earlier Milestone 0–4 documentation/regression files and generated RSS timestamp history. No database migration, RLS policy, provider configuration, game/review data model, canonical route architecture, or missing benchmark capability was added in Milestone 5.

## N. Remaining issues and evidence boundaries

- No real mobile/tablet viewport was available in Work, so narrow responsive behavior is deterministic rather than browser-proven.
- The final combined interaction commit did not receive a complete new browser pass after the Work usage limit was reached.
- Authenticated reader/editor/admin V4/V5 evidence remains blocked by the previously documented safe-fixture limitation; this milestone did not reopen that scope.
- Newsletter/provider delivery remains outside this milestone.
- The six missing benchmark capabilities remain out of scope.
- Existing known review metadata, game-mapping, RSS-cap, and other baseline warnings remain separate backlog items unless they produce a reader/growth signal.

## O. Recommendation for Milestone 6

Move to a bounded **Game Hub 2.0 / interconnected reader journey** slice.

Use the existing Games Database, Game Graph, Discovery Intelligence, entity-follow, review, commerce, and canonical game-page owners. Improve game-page information hierarchy and make the path from story to game to review/guide/related coverage clearer without creating a parallel game database or recommendation engine.

Suggested scope:

- clearer game identity/facts and Neural Critic score/review placement;
- content tabs/filters such as Latest, Reviews, Guides, and Deals using existing article/game relationships;
- stronger article → game and game → article/review/guide recirculation;
- verified follow CTA reuse;
- commerce only where a verified mapped offer exists;
- explicit empty states when a content class has no eligible coverage;
- desktop/mobile/light/dark acceptance criteria and the existing full regression suite.

Do not start Milestone 6 automatically and do not merge this branch until the Milestone 5 diff/report are reviewed.