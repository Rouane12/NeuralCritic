# Neural Critic Overhaul — Milestone 8 Batch 2 Report

## Milestone

**Game Coverage Completion / Evergreen Cluster Expansion — Batch 2**

Branch: `milestone-8-game-coverage-batch-2`

Generated production base after Batch 2: `7e57ff5adca20ce5173a8ff363c9b1cdf3c3daa9`

## A. Goal

Batch 2 continues Milestone 8's search-led coverage-completion strategy. It adds only established evergreen games for which Neural Critic already has durable editorial coverage and for which current official-source metadata can be verified.

It does not bulk-create all remaining unmapped titles.

## B. Official-source verification

Before the production Games Database write, current primary sources were checked.

### Super Mario Galaxy

Official Nintendo sources confirm the original Wii release, Nintendo as publisher/developer owner, and the game's gravity-driven 3D platforming identity. Nintendo's original Japanese Wii page gives the original release date as **2007-11-01**. Nintendo's current product pages also confirm the modern Nintendo Switch release/availability.

Primary sources recorded in the game metadata:

- `https://www.nintendo.co.jp/wii/rmgj/index.html`
- `https://www.nintendo.com/us/store/products/super-mario-galaxy-switch/`

### Super Mario Galaxy 2

Official Nintendo sources confirm the original Wii release, Nintendo ownership, Yoshi/Starship Mario gameplay identity, and the original release date of **2010-05-27** on Nintendo's Japanese Wii page. Nintendo's current product pages confirm the modern Nintendo Switch release/availability.

Primary sources recorded in the game metadata:

- `https://www.nintendo.co.jp/wii/sb4j/index.html`
- `https://www.nintendo.com/us/store/products/super-mario-galaxy-2-switch/`

### Dark Souls Remastered

Bandai Namco's official Dark Souls Remastered site confirms FromSoftware, PlayStation 4 / Xbox One / PC / Nintendo Switch support, and Action / Adventure / RPG classification. Bandai Namco's launch material is dated **2018-05-25**; Nintendo Switch followed later in 2018.

Primary source recorded in the game metadata:

- `https://www.bandainamcoent.com/games/dark-souls-remastered`

## C. Batch 2 Games Database additions

Three authoritative rows were added to the existing production `games` table:

1. **Super Mario Galaxy** — canonical slug `super-mario-galaxy`; connects the existing Neural Critic 9.8 retrospective review.
2. **Super Mario Galaxy 2** — canonical slug `super-mario-galaxy-2`; connects the existing Neural Critic 9.8 retrospective review.
3. **Dark Souls Remastered** — canonical slug `dark-souls-remastered`; connects the existing evergreen world-design feature.

The two Mario scores and `score_article_slug` values come from Neural Critic's existing structured review metadata. Dark Souls Remastered has no fabricated Neural Critic score or review pointer.

## D. Live mapping impact

Production Supabase was re-queried after the write.

Current state:

- 15 total Games Database rows
- 39 published stories with a non-empty `game_key`
- 26 mapped stories
- 13 unmapped stories
- 13 distinct unmapped game identities

Across Milestone 8 so far, the story-level gap has moved:

`23 unmapped -> 16 after Batch 1 -> 13 after Batch 2`

The remaining identities are:

- ANANTA
- Crazy Taxi: World Tour
- Fable
- Final Fantasy VII Revelation
- Gears of War: E-Day
- HUMANKIND 2
- Metro 2039
- Nodus Fall
- Path of Exile 2
- Persona 4 Revival
- Tom Clancy's Rainbow Six Tactics
- Tomb Raider: Legacy of Atlantis
- Warlock: Dungeons & Dragons

These remaining future/newer titles are not automatically approved for game-row creation. Each requires fresh identity/release verification and a traffic/editorial-value case.

## E. Generated publication verification

The established **Refresh publication discovery files** workflow was rerun against the live Games Database after Batch 2.

Generated `main` commit:

`7e57ff5adca20ce5173a8ff363c9b1cdf3c3daa9`

Compared with the prior generated production commit `195714bd80195b24b5fb9dcbe60f510680552b6f`, the exact generated diff was:

- added `games/dark-souls-remastered/index.html`
- added `games/super-mario-galaxy/index.html`
- added `games/super-mario-galaxy-2/index.html`
- added the three corresponding sitemap entries
- expected RSS timestamp-only refresh

No unrelated story, topic, author, runtime, schema, RLS, recommendation or commerce artifact changed.

## F. Canonical / SEO verification

Representative generated Super Mario Galaxy shell inspection confirmed:

- one authoritative `<meta name="description">`
- canonical `https://www.neuralcritic.net/games/super-mario-galaxy/`
- matching `og:url`
- `VideoGame` JSON-LD
- `BreadcrumbList` JSON-LD
- stored canonical game slug
- verified release date, genres, platforms, developer/publisher and official URL
- existing Game Hub 2.0 runtime

This also confirms the Batch 1 shared duplicate-description fix is active on newly generated game pages.

## G. Publication verification

The publication refresh job completed successfully, including:

- runtime fallback generation
- robots/sitemap/RSS generation
- canonical story shells
- Game Graph topic hubs
- canonical game pages
- author hubs
- structured-data enrichment
- publication reliability gate
- runtime consistency gate

GitHub Pages deployment **#961** successfully deployed `7e57ff5adca20ce5173a8ff363c9b1cdf3c3daa9`.

## H. Architecture preserved

Batch 2 introduces no new platform owner.

It continues to reuse:

- production Supabase `games`
- canonical stored `games.slug`
- Game Hub 2.0
- Article Journey 2.0
- Game Graph / `NeuralCriticDiscovery.related()`
- existing review metadata
- existing canonical publication generator
- existing sitemap and Pages deployment

No schema migration, RLS change, new recommendation scorer, new follow store, fake score, fake deal or hand-authored canonical Game Hub was introduced.

## I. Capability benchmark

No modeled GameSpot capability is promoted from this data-completion batch alone.

The conservative benchmark remains:

- 126 complete
- 68 partial
- 6 missing
- 0 intentionally excluded

## J. Recommendation

Milestone 8 has now captured the strongest obvious evergreen/review gaps from the original unmapped set.

Before creating another game batch, the remaining 13 newer/future identities should be evaluated against current search opportunity and coverage plans rather than automatically converted into Game Hubs. The next highest-value work should favor a title only when it supports a useful evergreen cluster or active search opportunity.
