# Neural Critic Overhaul — Milestone 6 Report

## Milestone

**Game Hub 2.0 & Interconnected Reader Journey**

Branch: `overhaul/milestone-6-game-hub-2`

Base inspected: `main` at `2997767756a38769ed8a889dc2dba6f5e2c36f70`

Pre-report implementation head: `6c97cd5f0e4434ae7b0c3b9a1f1ee1f0b6b4aaf9`

Pull request: #55

## A. Existing Game Hub architecture discovered

Neural Critic already had a canonical Games Database runtime rather than an empty placeholder system. `game.html`, `assets/game-page.js`, `assets/game-page.css`, `scripts/build_game_pages.py`, Supabase `games` / `game_releases`, Game Graph / Discovery Intelligence, review metadata, entity follows, commerce tables, analytics, and generated `/games/<slug>/` shells were the established owners.

The milestone therefore upgraded the existing Game Hub presentation and integration instead of introducing a second game database, recommendation engine, follow store, review store, commerce system, or analytics layer.

## B. Systems reused

Milestone 6 deliberately reuses:

- Supabase `games` and `game_releases`
- `NeuralCriticDiscovery.related()` for Game Graph ranking
- structured article `gameKey` / `game_key` identity
- existing canonical `/stories/<slug>/` links
- existing canonical `/games/<slug>/` generation
- existing series / franchise topic hubs
- `assets/entity-follows-v2.js` and `reader_entity_follows`
- existing review metadata and `score_article_slug`
- Commerce & Price Intelligence tables and affiliate behavior
- `NeuralCriticAnalytics`
- existing publication builders and Publication Health

No new schema or RLS migration was introduced.

## C. Game Hub 2.0 information hierarchy

The game hero now gives greater editorial weight to cover art, game title, release state, summary, platforms / genres, Neural Critic score when real score evidence exists, and a mapped review path.

The primary content area now places a dedicated Neural Critic review feature ahead of the broader coverage module when a real review exists. Game facts and platform release records remain visible without competing with the editorial journey.

The reader path is now explicitly shaped around:

`Story -> Game Hub -> Review / Guide / Latest Coverage / Deal -> Connected Coverage`

## D. Coverage navigation / classification

The existing game coverage surface now exposes four reader-facing views:

- Latest
- Reviews
- Guides
- Deals

Reviews and Guides are classified from structured article metadata and same-game identity rather than title keyword matching. Latest reuses Game Graph relationships with same-game coverage first, followed by allowed same-series, same-franchise, and useful shared-topic relationships.

Each view has an explicit empty state. No fake article or commerce cards are generated to populate an empty lane.

## E. Review integration

A mapped Neural Critic review can render as a dedicated review feature with score, headline, verdict / description, tested platform when recorded, publication/update date, and a canonical Read Review link.

A real-data edge case was found during validation: a published review can contain a structured review score even when the `games` row lacks its cached `neural_critic_score` / score pointer. The Game Hub was hardened so real structured review metadata can provide the review score instead of hiding an otherwise valid review feature.

No Metacritic, external critic score, critic consensus, or user score was invented.

## F. Guides integration

Same-game `game-guide` / Guides coverage now has a dedicated view. When no eligible guide exists, the hub renders an intentional empty state while leaving the rest of the game page functional.

All guide links use canonical `/stories/<slug>/` routes.

## G. Commerce behavior

Deals reuse the existing commerce tables only. A deal requires:

- a product mapped to the current `game_id`
- an active product
- an eligible current offer (`in_stock`, `preorder`, or `backorder`)
- a non-expired offer
- an active retailer

Affiliate offers retain sponsored / noopener / noreferrer handling and the existing `commerce_offer_click` analytics owner. A disclosure is rendered when affiliate offers are present.

Live Supabase inspection during this milestone showed 7 games, 8 release records, 0 active commerce products, and 0 eligible live offers. Therefore the correct current Deals behavior is the verified-offer empty state; no fake inventory was seeded.

## H. Follow behavior

Game Hub 2.0 loads the established `assets/entity-follows-v2.js` owner when needed. The Game Hub runtime does not write directly to `reader_entity_follows` and does not implement a second persistence path.

The existing follow owner remains responsible for signed-out login gating and signed-in persistence.

Authenticated V4 persistence was not newly re-proven in this milestone because no safe disposable credentialed verification identity was available. The existing anonymous access-boundary audit remained green.

## I. Game Graph / recirculation changes

`NeuralCriticDiscovery.related()` remains the ranking owner. Game Hub 2.0 combines direct structured same-game coverage with the established engine's allowed relationships:

1. same game
2. same series
3. same franchise
4. useful shared topic

The milestone did not introduce another recommendation score. Duplicate slugs are removed from the selected set.

Series and franchise exploration continues to use canonical topic hubs.

## J. SEO / internal-link impact

The existing canonical game shell generator remains authoritative for:

- `/games/<slug>/`
- canonical link
- VideoGame structured data
- BreadcrumbList structured data
- static game slug bootstrapping
- sitemap/publication integration

Game Hub story links use canonical `/stories/<slug>/` routes and series/franchise links use canonical topic routes.

The full Publication Health suite re-generated and audited canonical game shells successfully on the exact implementation head.

## K. Accessibility / responsive results

The new coverage selector uses ordinary buttons with `aria-pressed`, visible focus treatment, and no false ARIA tab pattern. Story, relation, and deal links have keyboard focus treatment. Reduced-motion behavior remains present.

Responsive CSS includes desktop, intermediate/tablet, and narrow-mobile contracts. The implementation does not use page-level `overflow-x:hidden` to mask layout defects.

A new deterministic Game Hub regression workflow verifies responsive contracts, but a complete real-device / mutable-viewport browser pass is not claimed by this report.

## L. Analytics changes

All new interaction telemetry uses `NeuralCriticAnalytics`:

- `game_hub_view_change`
- `game_hub_review_click`
- existing `game_page_recirculation_click` with content-view context
- existing `commerce_offer_click` with game-hub placement
- `game_hub_entity_click`
- existing `game_page_view` with useful coverage counts

No second analytics implementation or personal data was added.

## M. Regression tests

A dedicated `.github/workflows/game-hub-health.yml` workflow now regenerates canonical game shells, parse-checks the runtime/test, and runs `scripts/test_game_hub.js`.

The test protects meaningful contracts including:

- shared Game Graph owner
- structured same-game identity
- Latest / Reviews / Guides / Deals views
- explicit empty states
- canonical review/story links
- verified commerce gating
- existing entity-follow ownership
- canonical shell / schema ownership
- generated game shells
- responsive contracts
- existing analytics ownership
- single delegated interaction ownership

Two older audits (`audit_discovery_links.py` and `audit_games_database.py`) contained cache-version / implementation-shape assumptions that no longer matched the upgraded Game Hub. Those audits were updated to protect the current ownership contracts rather than being disabled or weakened.

## N. CI / browser / auth verification evidence

Exact implementation head `6c97cd5f0e4434ae7b0c3b9a1f1ee1f0b6b4aaf9`:

- Game Hub Health #7: **success**
- Publication Health #428: **success**

Publication Health included successful protected-runtime 5/5, reader-baseline 4/4, homepage/navigation 11/11, live anonymous auth-boundary audit, commerce audit, publication audit, capability-ledger audit, content parity, launch gate, Reader Auth audit, discovery audit, popularity audit, Games Database audit, Games Directory / release calendar audit, Review Intelligence audit, newsletter audits, publication reliability, runtime consistency, and domain portability.

A full new real-browser mobile/tablet/authenticated persistence pass is not claimed. This milestone's new behavior is supported by deterministic contract tests, live Supabase state inspection, and the full exact-head CI suite.

## O. Files changed and why

- `assets/game-page.js` — Game Hub 2.0 runtime, coverage views, review feature, commerce gating, Game Graph integration, analytics, structured review score fallback
- `assets/game-page.css` — upgraded hierarchy, review/coverage/deal presentation, focus, light/dark and responsive behavior
- `game.html` — refreshed Game Hub runtime/style asset versions
- `.github/workflows/game-hub-health.yml` — dedicated regression workflow
- `scripts/test_game_hub.js` — deterministic Game Hub contracts
- `scripts/audit_discovery_links.py` — current Game Hub discovery runtime ownership contract
- `scripts/audit_games_database.py` — current Games Database runtime/canonical ownership contract
- `docs/MILESTONE_6_REPORT.md` — milestone evidence and limitations

## P. Remaining limitations

- Live commerce inventory is currently empty, so an actual game-hub retailer click cannot be production-proven until a real provider feed exists.
- Authenticated Follow persistence was not re-proven with a disposable credentialed identity in this milestone.
- Complete mobile/tablet browser verification remains unclaimed; responsive behavior is deterministic/CI-covered.
- The Games Database currently contains only seven canonical games, so traffic value still depends heavily on expanding high-value game coverage through the established editorial/search workflow rather than adding more platform machinery.

## Q. Capability-ledger changes

No capability row is promoted solely from this implementation. The authoritative baseline remains conservative at:

- 126 complete
- 68 partial
- 6 missing
- 0 intentionally excluded

The milestone strengthens evidence and presentation for existing game-page, recirculation, review, release, follow, commerce, responsive, and accessibility capabilities, but the outstanding browser/auth verification limits remain relevant.

## R. Recommendation for Milestone 7

The next visible reader-experience milestone should upgrade the **article journey** around the now-stronger Game Hub instead of building another platform system.

Recommended focus:

`Article -> Game Hub -> Review / Guide -> Connected Coverage -> Next Story`

Milestone 7 should inspect the existing article runtime, Game Graph entity surfaces, Related / Connected Coverage, recirculation, review/guide presentation, and article sidebar. It should make the game/topic context and next useful click more obvious without replacing Discovery Intelligence or the article publishing runtime.

Do not begin Milestone 7 from this branch. Start it from freshly verified `main` after Milestone 6 merge and deployment verification.
