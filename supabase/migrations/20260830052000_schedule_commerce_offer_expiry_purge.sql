-- Purge expired provider content at the database layer.
-- Any provider that sets expires_at opts the offer into hard expiry, not merely
-- UI hiding. This is especially important for licensed API content with TTLs.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'neural-critic-commerce-expiry-purge',
  '*/15 * * * *',
  $$ delete from public.commerce_offers where expires_at is not null and expires_at <= now(); $$
);
