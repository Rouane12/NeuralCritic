# Neural Critic — Commerce & Price Intelligence

## Mission

Add a commerce/data layer underneath Neural Critic without turning the publication into an affiliate catalog.

The product should help readers answer high-intent questions such as:

- Where is this game cheapest right now?
- Is this price actually a deal?
- Which retailer has the best current offer?
- Has this SSD, monitor, controller, GPU, or other gaming product reached a historical low?
- Where can I buy a product discussed in a Neural Critic review or guide?

The core principle is the same one that makes small comparison utilities valuable: organize scattered purchasing data into a fast, trustworthy decision tool.

## Product architecture

`Retailer/API feed → normalization → Supabase → price intelligence → Deals page + article modules → analytics → affiliate revenue`

### Existing Neural Critic systems reused

- `public.games` remains the canonical identity for games.
- `articles.commercial_meta` remains the story-level commercial disclosure surface.
- Existing monetization runtime hardens affiliate links with `rel="sponsored"` and tracks affiliate clicks.
- Existing commercial disclosure policy remains authoritative.
- Existing publication, analytics, Supabase, canonical URL, and search infrastructure stays unchanged.

## Commerce data model

### `commerce_retailers`
Canonical retailers and affiliate-network metadata.

### `commerce_products`
Canonical products. Game products may reference `public.games`; gaming hardware can exist independently.

### `commerce_offers`
Current retailer-specific offers, prices, availability, destination URLs, and optional affiliate URLs.

### `commerce_price_history`
Historical price snapshots for trend charts, historical-low detection, and price-drop intelligence. Snapshots are generated automatically when a current offer changes price, list price, or availability.

### `commerce_article_products`
Explicit links between editorial stories and products for reusable `Where to Buy` modules.

### `games.metadata.storefronts`
Verified direct game-store destinations used by review pages before a live retailer price feed exists. Each storefront record carries platform, store, URL, region, verification context, and `affiliate: false`. This layer deliberately carries **no price, discount, availability, or scarcity claims**.

## V1 public experience

### `/deals.html`
A dedicated Neural Critic Price Intelligence surface with:

- search
- category filters
- platform/product context
- current price
- list/MSRP comparison where available
- discount percentage
- historical-low indicator when history exists
- retailer name
- availability
- last-updated freshness
- affiliate-safe `View Deal` links

The page must never invent prices. If no verified retailer feed is connected, it shows a clean feed-warming state rather than sample commerce data. Until real offer data exists, the page remains `noindex,follow` so Neural Critic does not ask Google to index a thin commerce surface.

### Homepage
A compact Price Intelligence entry point exists but remains hidden unless real active offers exist. This prevents permanent visual clutter while the feed is empty.

### Articles
Reviews, buying guides, and relevant stories can receive a `Where to Buy` module through `commerce_article_products` instead of manually embedding store links in editorial copy. Verified live offers remain the authoritative commerce path whenever an explicitly linked product has an active offer.

Published game reviews may also show a review-sidebar `Where to Buy` card backed by verified `public.games.metadata.storefronts` records when no live commerce offer exists. That fallback:

- links only to HTTPS direct storefront destinations;
- is limited to game reviews with a canonical game identity;
- never displays an unverified price or availability claim;
- never marks its links as sponsored or affiliate links;
- explicitly tells readers that Neural Critic currently receives no commission from those links;
- records separate storefront render, selection, and click analytics;
- automatically yields to the verified live-offer path once real offer data is available.

## Editorial and trust rules

1. Affiliate commission must never determine review score, verdict, recommendation, or ranking.
2. Affiliate links must be marked sponsored and disclose the commercial relationship.
3. Do not show fake scarcity, fake countdowns, invented MSRP, or fabricated historical lows.
4. Show price freshness and retailer identity clearly when price data is displayed.
5. Separate editorial recommendations from automatic price sorting.
6. Prefer useful buyer metrics over aggressive conversion UI.
7. Public browser clients receive read-only commerce access; ingestion/writes stay privileged.
8. Do not promote or index the Deals surface before verified live offer data exists.
9. Non-affiliate storefront links must not imply that Neural Critic earns a commission.
10. A storefront link is not a price feed: do not infer price, stock, discounts, or region availability from the existence of a store page.

## Rollout

### Commerce & Price Intelligence V1

- [x] Data architecture
- [x] Supabase tables + hardened RLS
- [x] Deals page
- [x] Price/deal card system
- [x] Homepage live-offer entry point with empty-feed guard
- [x] Article `Where to Buy` module with explicit story-product linking
- [x] Review-side non-affiliate official-storefront fallback
- [x] Commerce analytics instrumentation
- [x] Provider-neutral server-side feed importer
- [x] Automatic price-history snapshots
- [x] Historical-low detection logic
- [x] Dedicated CI/static commerce audit
- [ ] First real retailer/affiliate feed
- [ ] Scheduled provider refresh worker
- [ ] Analytics QA with real offer clicks
- [ ] Historical-low QA with real accumulated price history
- [ ] Remove Deals `noindex` gate after feed launch

### V2

- Multi-retailer comparison
- price-history charts
- historical-low pages
- deal alerts / watchlists
- game-page commerce integration
- hardware comparison utilities
- regional pricing
- programmatic buyer-intent landing pages where genuinely useful

## Current checkpoint · 8 September 2026

Commerce & Price Intelligence V1 now supports two intentionally separate review purchase paths:

1. **Verified offer mode** — the existing `commerce_*` tables provide price, retailer, availability, affiliate status, and future price-history intelligence.
2. **Official storefront mode** — published game reviews can show a compact, non-affiliate `Where to Buy` sidebar card from verified `public.games.metadata.storefronts` records when no live offer exists.

Official storefront mode does not turn Neural Critic into an affiliate catalog and does not pretend that a store URL is a price feed. It exists to give review readers a useful, direct purchase destination today while preserving the stricter live-offer architecture for future monetization.

The next commerce-data milestone remains **First Provider Feed**: choose and authenticate a real retailer/affiliate data source, normalize it into the importer contract, verify pricing/disclosure behavior with real data, then enable indexing and stronger public discovery.
