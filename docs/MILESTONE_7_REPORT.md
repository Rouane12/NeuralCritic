# Neural Critic Overhaul — Milestone 7 Report

## Milestone

**Article Journey 2.0**

Branch: `overhaul/milestone-7-article-journey-2`

Base: refreshed `main` at `92ed83c8325381e97464f7dc9929ff172afca265`

Pre-report implementation head: `8271f2b564e74626611a7b481eeb6397f037c5f1`

Pull request: #56

## A. Existing article-journey architecture discovered

Neural Critic already had a mature shared article runtime, canonical `/stories/<slug>/` shells, Discovery Intelligence, Game Graph entity links, Related Coverage, after-thread Recirculation, canonical topic hubs, canonical Game Hubs, analytics, reader/community systems, and publication-generation ownership.

The main reader-journey gap was not a missing recommendation engine. Article game context still sent readers to `/topics/game/<slug>/` even when a real canonical `/games/<slug>/` Game Hub existed, and the after-thread Explore CTA likewise preferred taxonomy context rather than the richer Game Hub destination.

Milestone 7 therefore upgrades presentation and routing around the established owners rather than introducing another article renderer, recommendation scorer, article/game relationship store, or game database.

## B. Systems reused

Milestone 7 deliberately reuses:

- canonical `/stories/<slug>/` story routes
- canonical `/games/<slug>/` Game Hubs
- Supabase `games` as the authoritative Game Hub identity source
- structured article `gameKey` / `game_key`
- `NeuralCriticDiscovery.related()` for recommendation ranking
- existing article Related Coverage
- existing after-thread Recirculation
- existing series / franchise / author topic hubs
- `NeuralCriticAnalytics`
- existing Content API / public Supabase client
- existing publication builders and Publication Health

No new schema, RLS policy, persistence owner, recommendation engine, or article renderer was introduced.

## C. Article-to-Game-Hub journey

For a published article with a `gameKey`, the article discovery owner now checks the existing public Games Database for an authoritative game record by game title. When a real mapped game exists, the article surfaces a prominent canonical Game Hub entry using the stored `games.slug`:

`Story -> /games/<slug>/`

The Game Hub entry appears in the existing Connected Coverage surface beneath the article metadata and can include real release-state / platform context already stored on the game record.

The stored game slug is used instead of deriving the route from article text. This matters for punctuation-sensitive identities such as `Baldur’s Gate 3`, whose canonical stored slug does not exactly equal a naive punctuation-derived slug.

## D. Unmapped-game behavior

No fake Game Hub route is created.

When an article has a `gameKey` that does not map to an existing `games` row, the established Game Graph topic link remains available through `/topics/game/<slug>/`.

Live Supabase inspection at milestone close showed:

- 53 published articles
- 39 published articles with a non-empty `game_key`
- 16 published articles currently mapped to an authoritative `games` row
- 23 published articles with a `game_key` but no matching canonical game row

This keeps the reader journey useful while making the remaining Games Database coverage gap explicit rather than hiding it.

## E. Connected Coverage behavior

Mapped game context now receives stronger visual prominence than generic taxonomy pills, while existing series, franchise, and author links remain available as secondary exploration paths.

Related story cards continue to use `NeuralCriticDiscovery.related(current, all, 3)`. The milestone does not modify the recommendation scoring contract or introduce a second selector.

Canonical related-story links remain `/stories/<slug>/`.

## F. After-thread Recirculation

The established after-thread Recirculation module still selects stories through `NeuralCriticDiscovery.related()`.

When the current article has a resolved canonical Game Hub, the module now prefers that Game Hub for its Explore CTA and labels the action `OPEN GAME HUB`.

When no canonical Game Hub is available, the previous topic-hub / section fallback remains intact.

The recirculation owner consumes the article discovery owner’s resolved game context rather than issuing a second Games Database lookup.

## G. Analytics

Existing analytics ownership is preserved.

`connected_coverage_click` now records whether the destination is a `game_hub` or `topic_hub`.

`recirculation_hub_click` likewise records the destination class while preserving the existing event owner and hub metadata.

No second analytics implementation or personal data was introduced.

## H. Presentation / accessibility

The mapped Game Hub surface adds:

- clear `GAME HUB` identity
- game title
- real release/platform context when present
- explicit `OPEN GAME HUB` CTA
- visible `:focus-visible` treatment
- light-mode presentation
- dark-mode presentation
- narrow-screen stacking
- reduced-motion protection

The implementation does not use global `overflow-x:hidden` to mask layout problems.

The Game Hub entry remains a real anchor link rather than JavaScript-only navigation.

## I. Runtime / cache ownership

`assets/content-api.js` remains the bootstrap owner for Discovery Intelligence, article discovery, and Recirculation.

Milestone 7 refreshes only the affected article-journey asset versions so generated canonical story shells pick up the new runtime after deployment.

The deliberate `article.html` change is only the Content API cache-version bump; the article template / rendering system was not redesigned in this milestone.

## J. SEO / internal-link impact

Canonical story ownership remains unchanged.

The milestone adds a stronger internal-link path from eligible canonical stories to existing canonical Game Hubs:

`/stories/<slug>/ -> /games/<slug>/`

This complements the reverse Game Hub-to-story paths introduced in Milestone 6 and strengthens the intended evergreen cluster without adding keyword-stuffed copy or duplicate route systems.

Unmapped games retain canonical topic-hub paths until a real Games Database row exists.

## K. Regression coverage

A dedicated `.github/workflows/article-journey-health.yml` workflow now parse-checks the changed runtimes and runs `scripts/test_article_journey.js` plus the shared discovery audit.

The deterministic Article Journey suite protects:

- read-only reuse of the existing Games Database
- authoritative title lookup + stored game slug
- canonical `/games/<slug>/` destinations
- no fake Game Hub route for unmapped games
- single shared article game-context signal
- no second games lookup in Recirculation
- shared `NeuralCriticDiscovery.related()` ownership
- canonical related-story links
- series / franchise / author hub preservation
- existing analytics ownership
- responsive / light / dark / keyboard presentation contracts
- no page-level overflow masking

The broader discovery audit was extended to protect the new canonical Story-to-Game-Hub journey and refreshed runtime wiring.

## L. Exact-head CI evidence

Pre-report implementation head `8271f2b564e74626611a7b481eeb6397f037c5f1`:

- Article Journey Health #6: **success**
- Game Hub Health #14: **success**
- Publication Health #436: **success**

Publication Health successfully covered protected runtime ownership, reader baseline, homepage/navigation contracts, anonymous auth boundaries, commerce, publication, 200-capability ledger, live/generated parity, launch gate, Reader Auth, discovery, popularity, Games Database, Games Directory/release calendar, Review Intelligence, newsletter systems, publication reliability, runtime consistency, and domain portability.

## M. Live-data QA findings

Live data inspection directly influenced implementation rather than being treated as documentation-only evidence.

A punctuation-sensitive canonical slug mismatch was found for `Baldur’s Gate 3`. The first implementation would have derived `baldur-s-gate-3` from the article game name, while the authoritative game record uses `baldurs-gate-3`.

The resolver was corrected before merge to match the authoritative game by title and then consume its stored canonical slug. The final implementation no longer guesses canonical game routes from article text.

## N. Browser / responsive verification limitations

A new complete real-browser / mutable-viewport pass is not claimed for Milestone 7.

Responsive, light/dark, keyboard/focus and reduced-motion behavior are protected by deterministic contracts and the full exact-head CI suite, but a genuine final mobile/tablet browser run remains an outstanding publication-wide verification limitation carried from earlier milestones.

No authenticated persistence behavior was changed in this milestone.

## O. Files changed and why

- `assets/article-discovery.js` — authoritative Game Hub resolution, mapped Game Hub presentation, shared context signal and destination analytics
- `assets/recirculation.js` — consume shared mapped-game context and prefer Game Hub exploration without changing recommendation ranking
- `assets/discovery-intelligence.css` — Article Journey Game Hub presentation, light/dark, focus, responsive and reduced-motion behavior
- `assets/content-api.js` — refreshed affected Article Journey runtime/style asset versions
- `article.html` — deliberate Content API cache-bust only
- `scripts/test_article_journey.js` — deterministic Article Journey contracts
- `scripts/audit_discovery_links.py` — canonical Game Hub / shared runtime regression contracts
- `.github/workflows/article-journey-health.yml` — focused CI workflow
- `docs/MILESTONE_7_REPORT.md` — milestone evidence and limitations

## P. Capability-ledger impact

No capability row is promoted solely from Milestone 7 implementation evidence.

The authoritative benchmark remains conservative at:

- 126 complete
- 68 partial
- 6 missing
- 0 intentionally excluded

Milestone 7 materially strengthens article-to-game internal linking and reader recirculation, but the outstanding browser verification limits still prevent unsupported status promotion.

## Q. Remaining issues

- 23 published stories currently reference game identities that do not yet have canonical Games Database rows.
- Complete real-browser mobile/tablet verification remains unclaimed.
- Authenticated reader persistence was not part of this milestone and was not re-tested.
- Traffic impact must be measured after production exposure; this milestone improves the path but does not by itself guarantee higher recirculation or search clicks.

## R. Recommendation for Milestone 8

Milestone 8 should focus on **Game Coverage Completion / Evergreen Cluster Expansion**, not another platform subsystem.

The highest-value platform/editorial gap exposed by Milestone 7 is the 23 published game references without canonical `games` rows. The next slice should audit which of those games deserve canonical Game Hubs based on search/editorial value, add only authoritative game/release metadata for selected high-value titles, regenerate canonical hubs, and then verify the now-complete Story -> Game Hub -> Review / Guide / Related Coverage journey.

Do not bulk-create low-value or poorly sourced game records merely to reduce the unmapped count.
