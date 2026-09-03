# Neural Critic Overhaul — Milestone 8 Report

## Milestone

**Game Coverage Completion / Evergreen Cluster Expansion — Batch 1**

Branch: `milestone-8-game-coverage-batch-1`

Base after the live publication refresh: `a9696a7c9ce098cfa2b921ff44974ad0fbf1d217`

Pre-report implementation head: `8dc9ef35727cfc0e6db0a4d58d4266c9bc34aff2`

Pull request: #57

## A. Goal

Milestone 8 does not create another Games Database or recommendation system. It closes high-value gaps between already-published Neural Critic coverage and the established canonical Game Hub architecture:

`Story -> /games/<slug>/ -> Review / Guide / Latest / Related Coverage`

The selection rule is editorial/search value first, not reducing the unmapped count for its own sake.

## B. Starting live-data gap

Milestone 7 closed with 39 published stories carrying a non-empty `game_key`, of which 16 mapped to existing canonical Games Database rows and 23 did not.

The first Milestone 8 slice ranked those unmapped identities by existing coverage depth and reader/search usefulness, then selected a deliberately small batch rather than bulk-seeding every title.

## C. Batch 1 Games Database additions

Five authoritative game rows were added through the existing live `games` owner:

1. **Red Dead Redemption 2** — canonical slug `red-dead-redemption-2`; connects the existing Neural Critic review and its real 9.3 score.
2. **Super Mario Odyssey** — canonical slug `super-mario-odyssey`; connects the existing Neural Critic review and its real 9.7 score.
3. **Cyberpunk 2077** — canonical slug `cyberpunk-2077`; connects the existing beginner guide.
4. **The Witcher 3: Wild Hunt** — canonical slug `the-witcher-3-wild-hunt`; connects two existing published stories.
5. **EXODUS** — canonical slug `exodus`; connects two existing published stories.

The records use the established Games Database fields for title, stored canonical slug, summary, release state/date, developer, publisher, series/franchise where applicable, genres, platforms, official URL, Neural Critic score/review pointer where one actually exists, and source-verification metadata.

No fake score, fake commerce data, or inferred review pointer was added.

## D. Live impact after write

A production Supabase re-query after Batch 1 showed:

- 12 total Games Database rows
- 39 published stories with a non-empty `game_key`
- 23 stories now mapped to canonical Games Database rows
- 16 stories still unmapped
- 16 distinct unmapped game identities remain

Therefore Batch 1 closes **7 previously unmapped Story-to-Game-Hub relationships**.

The remaining unmapped identities are:

- ANANTA
- Crazy Taxi: World Tour
- Dark Souls Remastered
- Fable
- Final Fantasy VII Revelation
- Gears of War: E-Day
- HUMANKIND 2
- Metro 2039
- Nodus Fall
- Path of Exile 2
- Persona 4 Revival
- Super Mario Galaxy
- Super Mario Galaxy 2
- Tom Clancy's Rainbow Six Tactics
- Tomb Raider: Legacy of Atlantis
- Warlock: Dungeons & Dragons

These are not automatically authorized for bulk creation. Future batches must verify current official identity/release facts and justify search/editorial value individually.

## E. Existing architecture reused

Milestone 8 deliberately reuses:

- Supabase `games` as the canonical Game Hub identity owner
- stored `games.slug` canonical routing
- `game_releases` where release rows exist
- Game Hub 2.0 runtime
- Article Journey 2.0 title-to-authoritative-game resolution
- `NeuralCriticDiscovery.related()` / Game Graph ranking
- canonical `/stories/<slug>/` story routes
- canonical `/games/<slug>/` game routes
- existing review metadata and `score_article_slug`
- existing sitemap and game-shell builders
- Publication Health and Game Hub Health

No second article/game relationship store, recommendation scorer, follow system, review store, or publication builder was introduced.

## F. Generated publication result

The existing **Refresh publication discovery files** workflow was rerun after the live Games Database write.

The regenerated `main` commit was:

`a9696a7c9ce098cfa2b921ff44974ad0fbf1d217`

Compared with the prior generated `main`, the publication refresh added exactly:

- `games/cyberpunk-2077/index.html`
- `games/exodus/index.html`
- `games/red-dead-redemption-2/index.html`
- `games/super-mario-odyssey/index.html`
- `games/the-witcher-3-wild-hunt/index.html`
- the corresponding sitemap entries

The only unrelated generated difference was the expected RSS timestamp refresh.

GitHub Pages deployment #958 successfully deployed that generated commit.

## G. Canonical / structured-data verification

Representative generated shell review confirmed the established game-page builder emits:

- canonical `/games/<slug>/`
- matching `og:url`
- index/follow robots metadata
- `VideoGame` JSON-LD
- `BreadcrumbList` JSON-LD
- authoritative game summary
- release date, genres, platforms, developer and publisher where present
- official source URL via `sameAs`
- `NEURAL_CRITIC_STATIC_GAME_SLUG` using the stored canonical slug

The Red Dead Redemption 2 shell, for example, correctly identifies its canonical URL as `/games/red-dead-redemption-2/` and carries its authoritative Rockstar metadata.

## H. SEO defect found and fixed

Reviewing the newly generated shells exposed a pre-existing shared generator defect: a generated game page contained both the authoritative game-summary `<meta name="description">` and the generic description inherited from `game.html`.

The fix stays inside the established `scripts/build_game_pages.py` owner. `render_game()` now removes the generic template description before injecting canonical game metadata.

This is a shared fix for every generated Game Hub rather than a five-page patch.

## I. Regression contract

`scripts/audit_games_database.py` now imports the real game-shell renderer and renders a deterministic fixture.

The audit fails unless the generated shell:

- contains exactly one `<meta name="description">`
- uses the authoritative game summary as that description
- does not retain the generic template description
- retains the expected canonical `/games/<slug>/` URL

This tests rendering behavior rather than merely checking for the presence of a new source string.

## J. Exact-head CI evidence

Pre-report implementation head:

`8dc9ef35727cfc0e6db0a4d58d4266c9bc34aff2`

- **Game Hub Health #16: success**
  - regenerated canonical game shells
  - parse-checked Game Hub runtime and regression contract
  - verified Game Hub 2.0 contracts
- **Publication Health #443: success**
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
  - Games Directory/release calendar
  - Review Intelligence
  - newsletter systems
  - publication reliability
  - browser runtime consistency
  - domain portability

The Games Database audit passed with the new canonical metadata rendering contract active.

## K. Capability-ledger impact

No GameSpot benchmark capability is promoted solely because five more canonical Game Hubs exist.

The benchmark remains conservative at:

- 126 complete
- 68 partial
- 6 missing
- 0 intentionally excluded

Milestone 8 improves real coverage depth and internal-link completeness rather than manufacturing a capability-count increase.

## L. Scope / safety boundaries

Batch 1 includes:

- five verified canonical game identities
- seven repaired story-to-game relationships
- generated canonical hubs and sitemap discovery
- one shared game-page SEO metadata correction
- deterministic regression coverage

Batch 1 does **not** include:

- bulk creation of all remaining game identities
- a new Games Database schema
- RLS changes
- Game Graph ranking changes
- fake releases, scores, products, prices or offers
- a second recommendation or follow owner
- editorial rewrites of the connected stories

## M. Remaining limitations

- 16 published game-key stories still lack canonical Games Database rows.
- Those remaining identities require current official verification before any future Game Hub is created.
- The newly deployed Batch 1 hubs were generated before the duplicate-description code fix; the shared metadata correction will take production effect only after PR #57 is merged and the publication workflow regenerates the hubs.
- A new interactive mutable-viewport browser pass is not claimed. Responsive Game Hub behavior remains covered by the existing Game Hub contracts and prior milestone evidence.
- Search/traffic impact must be measured after crawl/indexing; adding a canonical cluster path does not guarantee traffic by itself.

## N. Recommendation for the next Milestone 8 slice

After PR #57 merges and post-merge generation is verified, prioritize a second **small** batch rather than all 16 remaining identities.

The strongest evergreen candidates from existing Neural Critic coverage are likely the already-reviewed/evergreen games such as **Super Mario Galaxy**, **Super Mario Galaxy 2**, and **Dark Souls Remastered**, subject to fresh official-source verification before any write.

Future or newly announced titles should be added only when their identity, release facts and editorial/search value are current and well sourced.
