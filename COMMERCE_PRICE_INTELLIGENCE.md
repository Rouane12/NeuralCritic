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
Reviews, buying guides, and relevant stories can receive a `Where to Buy` module through `commerce_article_products` instead of manually embedding store links in editorial copy. The module renders only when an explicitly linked product also has a live offer.

## Editorial and trust rules

1. Affiliate commission must never determine review score, verdict, recommendation, or ranking.
2. Affiliate links must be marked sponsored and disclose the commercial relationship.
3. Do not show fake scarcity, fake countdowns, invented MSRP, or fabricated historical lows.
4. Show price freshness and retailer identity clearly.
5. Separate editorial recommendations from automatic price sorting.
6. Prefer useful buyer metrics over aggressive conversion UI.
7. Public browser clients receive read-only commerce access; ingestion/writes stay privileged.
8. Do not promote or index the commerce surface before verified live offer data exists.

## Rollout

### Commerce & Price Intelligence V1

- [x] Data architecture
- [x] Supabase tables + hardened RLS
- [x] Deals page
- [x] Price/deal card system
- [x] Homepage live-offer entry point with empty-feed guard
- [x] Article `Where to Buy` module with explicit story-product linking
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

## Current checkpoint · 30 August 2026

Commerce & Price Intelligence V1 is structurally implemented on `feature/commerce-intelligence-v1` / PR #26. The live Neural Critic Supabase project contains the commerce schema and automated history trigger, but intentionally contains zero commerce retailers, products, offers, price points, or article-product links until a verified provider is connected.

The next milestone is therefore not more UI. It is **First Provider Feed**: choose and authenticate a real retailer/affiliate data source, normalize it into the importer contract, verify pricing/disclosure behavior with real data, then enable indexing and stronger public discovery.
