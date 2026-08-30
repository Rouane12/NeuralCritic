# Neural Critic — Amazon Creators API Provider

## Status · 30 August 2026

The Amazon provider is implemented but intentionally dormant. Neural Critic has no Amazon credentials or live Amazon commerce rows configured in this repository.

Amazon has deprecated PA-API 5.0 in favor of the Creators API. Current Amazon documentation says Creators API access requires:

1. enrollment in Amazon Associates for the target marketplace;
2. final acceptance into the Associates program;
3. at least 10 qualifying sales during the previous 30 days;
4. Creators API registration and API credentials.

Official documentation should be re-checked immediately before activation because program terms can change.

## Neural Critic implementation

### Durable catalog

`data/commerce/amazon_catalog.json` is a curated ASIN catalog. ASINs may be retained long-term under Amazon's current program rules, while Neural Critic owns the durable product title/category/brand metadata entered in this file.

The provider deliberately does **not** use Amazon SearchItems, Amazon titles, or Amazon images as durable catalog content.

### Provider adapter

`scripts/providers/amazon_creators_feed.py`

- authenticates with Creators API using server-side credentials;
- calls `GetItems` for curated ASINs;
- requests only offer/availability fields needed for the commerce UI;
- uses Amazon's tagged `detailPageURL` as the affiliate destination;
- sets Amazon offers to expire after 55 minutes;
- emits the normalized feed consumed by `scripts/import_commerce_feed.py`;
- never puts credentials in browser JavaScript.

### Retention safeguards

Amazon's current Creators API best-practice documentation lists an Offers cache TTL of 1 hour and other returned resources at 1 day. Neural Critic therefore treats Amazon as a current-price provider, not as a permanent historical-price source.

- `commerce_retailers.price_history_mode` defaults to `disabled`.
- The price-history trigger only records providers explicitly set to `allowed`.
- Amazon offers carry `expires_at` before the one-hour cache limit.
- Supabase Cron runs `neural-critic-commerce-expiry-purge` every 15 minutes and deletes expired offer rows.
- Amazon price cards/modules show an absolute price timestamp and provider-specific change-at-purchase disclosure.

## Scheduled refresh

`.github/workflows/refresh-commerce.yml` checks twice per hour. It remains a successful no-op while the catalog is empty or credentials are absent.

Activation requires GitHub Actions secrets:

- `AMAZON_CREATORS_CLIENT_ID`
- `AMAZON_CREATORS_CLIENT_SECRET`
- `AMAZON_ASSOCIATES_PARTNER_TAG`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key must never be exposed to the public site.

## Launch gate

Do not activate/promote Amazon commerce until all of the following are true:

- Amazon Associates account is accepted.
- Creators API access is actually approved.
- At least one curated ASIN is added after editorial review.
- Required GitHub secrets are configured.
- A manual provider refresh succeeds with live data.
- Price timestamps, affiliate disclosures, and destination links are checked in production.
- Commercial click analytics are verified.
- `deals.html` remains `noindex` until the live feed has enough genuinely useful coverage to deserve search indexing.

## Bootstrap reality

Because Creators API currently requires recent qualifying sales, Amazon may not be the first provider to produce live automated prices. Neural Critic can keep the Amazon adapter dormant while another provider with acceptable commercial/API terms becomes the first live feed. The commerce schema and importer are provider-neutral by design.
