# Neural Critic Overhaul — Milestone 9 Report

## Milestone

**Reviews + Guides Journey**

Branch: `overhaul/milestone-9-reviews-guides-journey`

Base: `2c16422fbdd3cf7d135b495c0645b2fd449b81af`

Verified implementation head: `7e734418da5c3bcb0627bfdc54591a1d25ece62d`

Pull request: #59

## A. Goal

Milestone 9 closes the visible reader-journey seams between systems that already existed:

`Review / Guide -> Game Hub -> related Reviews / Guides / Latest coverage`

The milestone does not create another review database, guide database, recommendation engine, or game relationship store. It makes the existing Review Intelligence, published guide coverage, Games Database, canonical routes, Content API, Game Hub 2.0 and Article Journey work as one clearer reader path.

## B. Live-data basis

A production Supabase audit before implementation showed:

- **9 published scored reviews**
- all 9 reviews have a non-empty game identity
- all 9 reviews map to existing Games Database rows
- **6 published guides**
- all 6 guides have a non-empty game identity
- all 6 guides map to existing Games Database rows

Milestone 8 therefore removed the previous data blocker. Milestone 9 is a presentation/discovery integration milestone rather than a data-seeding milestone.

Three historical reviews still omit `testedPlatform`; Milestone 9 does not invent or infer those values.

## C. Existing architecture reused

Milestone 9 reuses:

- `/reviews/` Review Intelligence
- published `articles`
- structured `article_format`, `editorial_section`, `platforms`, `game_key` and `review_meta`
- Supabase `games` as the canonical game-identity owner
- stored canonical `games.slug`
- `NeuralCriticContentAPI`
- canonical `/stories/<slug>/`
- canonical `/games/<slug>/`
- Game Hub 2.0 coverage tabs
- Article Journey 2.0 Story -> Game Hub trail
- existing analytics owner
- existing publication sitemap builder
- existing category route as compatibility surface only
- existing Publication Health, Article Journey Health, Game Hub Health and Social Preview QA

No parallel content owner or scoring system was added.

## D. Reviews hub changes

The established `/reviews/` hub remains the canonical review destination.

Each review archive card can now expose two explicit actions when a canonical game mapping exists:

- **READ REVIEW** -> `/stories/<review-slug>/`
- **OPEN GAME HUB** -> `/games/<stored-game-slug>/`

Game Hub links are never guessed by slugifying article titles. Review `gameKey` is resolved against the authoritative Games Database title and the stored game slug is used for navigation.

The hub also adds direct entry points to Guides and Games.

Existing score filtering, search, platform filtering, sort behavior and Review Intelligence analytics remain in place.

A `?platform=<taxonomy-platform>` parameter now initializes the Review hub platform filter when it matches a known platform group.

## E. Canonical Guides hub

Milestone 9 adds a dedicated canonical `/guides/` reader surface rather than continuing to treat Guides as only a generic category query.

The hub includes:

- canonical and social metadata
- published guide count
- canonical Game Hub connection count
- platform-group count
- guide search
- platform filtering
- newest / oldest / game-title sorting
- responsive guide cards
- **READ GUIDE** canonical story action
- **OPEN GAME HUB** authoritative game action
- direct Reviews and Games entry points
- guide-view, guide-click and Guide -> Game Hub analytics events

Guide classification uses structured metadata (`article_format = game-guide`, `category = GUIDE`, or `editorial_section = guides`). It does not guess guide identity from headline keywords.

## F. Shared Content API ownership

The first implementation pass had the Review and Guide runtimes querying `articles` and `games` directly. That worked, but it would have created duplicate public read ownership.

Before PR verification, the design was tightened:

- `NeuralCriticContentAPI.publishedIndex()` remains the shared published-article read contract.
- new `NeuralCriticContentAPI.publishedGames()` is the shared Games Database index read contract.
- Reviews consume both contracts through `NeuralCriticContentAPI`.
- Guides consume both contracts through `NeuralCriticContentAPI`.
- Review/Guide runtime files no longer create their own direct `articles` or `games` Supabase queries.

The two clean hubs pin the M9 Content API URL so the new `publishedGames()` contract is not hidden behind a stale browser asset cache.

## G. Compatibility routing

Existing publication navigation and older inbound URLs may still point to forms such as:

- `category.html?section=reviews`
- `category.html?section=guides`
- legacy `category=review(s)` / `category=guide(s)` variants

The existing category compatibility boundary now resolves Review/Guide desk requests to:

- `/reviews/`
- `/guides/`

A recognized platform parameter is preserved, for example a Review or Guide platform route becomes `/reviews/?platform=...` or `/guides/?platform=...`.

This keeps old links functional without preserving the generic category page as the preferred reader destination.

The shared publication-nav runtime itself is intentionally not rewritten in this slice; changing its cache key across every generated shell would broaden the milestone unnecessarily. The compatibility route guarantees correct reader behavior while the sitemap and clean hubs establish the preferred discovery destinations.

## H. Search / sitemap behavior

The sitemap builder now includes:

- `https://www.neuralcritic.net/reviews/`
- `https://www.neuralcritic.net/guides/`

and stops intentionally seeding legacy Review/Guide category-query URLs.

A check of the actual generated production sitemap confirmed that canonical story discovery already uses clean `/stories/<slug>/` URLs. Milestone 9 does not alter that established story-routing contract.

## I. Accessibility / responsive contracts

Both Review and Guide journey surfaces include deterministic contracts for:

- mobile single-column card layouts at the established 620px breakpoint
- intermediate two-column card layouts
- keyboard-visible focus on new reader actions
- reduced-motion behavior for hover transforms
- semantic search/select labels
- explicit Review tab roles/selection state inherited from Review Intelligence

No interactive mutable-viewport branch browser session is claimed in this mode. Responsive behavior is therefore code/CI contract verified until post-merge production observation.

## J. Analytics

Existing Review Intelligence events remain authoritative.

Milestone 9 adds bounded navigation context:

- `review_game_hub_click`
- `guide_intelligence_view`
- `guide_intelligence_click`
- `guide_game_hub_click`

These events measure whether the new journey surfaces actually move readers deeper into the publication. No second analytics owner was introduced.

## K. Deterministic regression audit

`scripts/audit_review_intelligence.py` is expanded from a Review Intelligence presence audit into a Reviews + Guides journey audit.

It verifies:

- clean Review and Guide canonical hubs
- pinned M9 Review / Guide / Content API assets
- shared Content API ownership for article and game reads
- absence of direct Review/Guide Supabase content ownership
- canonical story URL construction
- authoritative stored Game Hub slug construction
- no slug guessing
- Review -> Game Hub actions and analytics
- Guide -> Game Hub actions and analytics
- structured guide classification
- responsive/focus/reduced-motion contracts
- clean Review/Guide sitemap roots
- absence of preferred legacy Review/Guide category sitemap URLs
- compatibility routing to clean hubs
- every published fallback review has a game identity that maps to a generated canonical Game Hub
- every published fallback guide has a game identity that maps to a generated canonical Game Hub

At the verified implementation head the audit passes with **9 reviews and 6 guides** mapped to generated canonical Game Hubs.

## L. Exact-head CI evidence

Verified implementation head:

`7e734418da5c3bcb0627bfdc54591a1d25ece62d`

All relevant PR checks passed:

- **Publication Health #446 — success**
  - JavaScript parse checks
  - protected runtime ownership
  - reader baseline
  - homepage/navigation contracts
  - anonymous auth boundaries
  - commerce
  - publication surface
  - overhaul baseline
  - 200-capability ledger
  - live/generated content parity
  - launch gate
  - Reader Auth
  - discovery
  - popularity
  - Games Database
  - Games Directory / release calendar
  - Reviews + Guides journey audit through the existing Review Intelligence step
  - newsletter systems
  - publication reliability
  - browser runtime consistency
  - domain portability
- **Article Journey Health #8 — success**
- **Game Hub Health #18 — success**
- **Social Preview QA #30 — success**

The report commit is documentation-only and does not change the verified implementation tree.

## M. Capability-ledger impact

Milestone 9 improves integration depth and reader movement, but it does not manufacture a benchmark promotion without stronger end-to-end browser evidence.

The conservative benchmark therefore remains:

- 126 complete
- 68 partial
- 6 missing
- 0 intentionally excluded

## N. Files changed

Product/runtime:

- `assets/content-api.js`
- `assets/review-intelligence.js`
- `assets/review-intelligence.css`
- `assets/guide-intelligence.js`
- `assets/guide-intelligence.css`
- `reviews/index.html`
- `guides/index.html`
- `category.html`
- `scripts/build_sitemap.py`

Regression:

- `scripts/audit_review_intelligence.py`

Documentation:

- `docs/MILESTONE_9_REPORT.md`

## O. Remaining limitations / next decision

Milestone 9 intentionally does not solve every visible publication seam.

Known follow-ups include:

- three historical reviews still lack explicit `testedPlatform` metadata
- Review/Guide clean hubs are live-data hydrated; richer static archive fallback / ItemList structured data remains a possible SEO hardening step if measurement justifies it
- the shared global nav still emits compatibility category URLs for Review/Guide links; they resolve correctly to clean hubs, but a future bounded navigation cache-bust can make those hrefs direct without mixing that risk into this milestone
- interactive production verification must happen after merge/deployment
- remaining Milestone 8 unmapped game identities should stay search-led rather than bulk-created

The next platform change should be chosen from observed reader/search friction rather than automatically starting another large milestone. The immediate post-merge goal is to verify that the Reviews and Guides surfaces render correctly in production and that the new internal journey is visible to readers and crawlers.
