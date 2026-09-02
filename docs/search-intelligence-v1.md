# Search Intelligence V1

Search Intelligence V1 is an additive, private data pipeline that imports finalized Google Search Console query/page metrics into Supabase. It does **not** change the public site, canonical story generation, Discovery Intelligence, recirculation, popularity signals, Game Graph, reader accounts, or the article runtime.

## Architecture

```text
Google Search Console
        |
        | read-only Search Analytics API
        v
scripts/sync_search_console.py
        |
        | service-role server-side write
        v
public.search_console_daily (Supabase)
        |
        | editor/admin read only
        v
Future Newsroom Search Intelligence UI
```

The collector requests finalized `date + query + page` rows, stores clicks, impressions, CTR and average position, and derives `story_slug` when the page maps to `/stories/<slug>/` (or the legacy `article.html?slug=` compatibility URL). Recent finalized days are re-read and upserted, so the job is idempotent and can safely catch late Search Console data.

## Safety gates

- The scheduled job is dormant unless the repository variable `SEARCH_INTELLIGENCE_ENABLED` is exactly `true`.
- The Google credential and Supabase service-role key are GitHub Secrets only. They must never be added to browser JavaScript or committed files.
- The Search Console scope is read-only: `https://www.googleapis.com/auth/webmasters.readonly`.
- Supabase RLS exposes the metrics table only to authenticated Neural Critic `editor` / `admin` profiles.
- No public-facing Neural Critic files are modified by the sync.
- The first live run should happen only after the migration, Google access, and dry-run have all been verified.

## One-time setup

### 1. Apply the Supabase migration

Apply:

`supabase/migrations/20260902000000_search_intelligence_v1.sql`

This creates `public.search_console_daily` with private RLS and idempotent row identity on:

`metric_date + site_url + search_type + query + page_url`

### 2. Create read-only Google API access

In a Google Cloud project:

1. Enable the **Google Search Console API**.
2. Create a service account for the Neural Critic Search Intelligence collector.
3. Create a JSON key for that service account.
4. In Google Search Console, add the service-account email to the exact Neural Critic property with permission sufficient to read Search Console data.

Do not commit the JSON key.

### 3. Configure GitHub

Repository secret:

- `GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON` — the complete service-account JSON object.

Existing repository secret reused by the collector:

- `SUPABASE_SERVICE_ROLE_KEY`

Repository variable:

- `GSC_SITE_URL` — the Search Console property identifier exactly as Google defines it, for example `sc-domain:neuralcritic.net` for a Domain property or `https://www.neuralcritic.net/` for a URL-prefix property.

Leave `SEARCH_INTELLIGENCE_ENABLED` unset or false during setup.

## Rollout sequence

1. Merge the V1 code only after review.
2. Apply the Supabase migration.
3. Configure `GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON` and `GSC_SITE_URL`.
4. Run **Sync Search Console intelligence** manually with `dry_run = true`.
5. Confirm the workflow reports rows fetched and a sensible number of story rows, with `rows_written = 0`.
6. Run it manually again with `dry_run = false`.
7. Verify rows in `public.search_console_daily` and confirm canonical stories have the expected `story_slug`.
8. Set repository variable `SEARCH_INTELLIGENCE_ENABLED=true` to allow the daily scheduled sync.

Only after the stored data has been validated should the existing private Newsroom receive a read-only Search Intelligence view.

## Manual backfill

The script also supports explicit dates when run in a trusted server-side environment:

```bash
python scripts/sync_search_console.py --start-date 2026-08-01 --end-date 2026-08-31 --dry-run
```

Remove `--dry-run` only when the Supabase service-role environment variables are present and the result has been reviewed.

## Required environment variables

- `GOOGLE_SEARCH_CONSOLE_CREDENTIALS_JSON`
- `GSC_SITE_URL`
- `GSC_SEARCH_TYPE` (workflow uses `web`)
- `SUPABASE_URL` (writes only)
- `SUPABASE_SERVICE_ROLE_KEY` (writes only)

## V1 boundaries

V1 deliberately does **not**:

- change titles or metadata automatically;
- publish or edit stories;
- alter canonical URLs or sitemap generation;
- modify Discovery Intelligence rankings;
- expose Search Console queries on the public website;
- make SEO recommendations before enough real data has accumulated.

Those boundaries keep the first milestone measurable and low-risk: prove that Neural Critic can ingest accurate Google search demand data before using it to influence editorial decisions.
