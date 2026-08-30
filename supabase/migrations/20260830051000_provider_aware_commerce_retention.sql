-- Provider-aware commerce retention.
-- Price history is opt-in because affiliate/data providers can restrict how long
-- price and availability content may be stored.

alter table public.commerce_retailers
  add column if not exists price_history_mode text not null default 'disabled'
    check (price_history_mode in ('disabled','allowed')),
  add column if not exists offer_cache_ttl_minutes integer
    check (offer_cache_ttl_minutes is null or offer_cache_ttl_minutes > 0);

comment on column public.commerce_retailers.price_history_mode is
  'Whether provider terms permit Neural Critic to retain historical price snapshots. Disabled by default.';
comment on column public.commerce_retailers.offer_cache_ttl_minutes is
  'Provider-specific maximum age for current offer data when contractual/API terms require a TTL.';

create or replace function public.capture_commerce_offer_history()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  history_mode text;
begin
  select r.price_history_mode
    into history_mode
  from public.commerce_retailers r
  where r.id = new.retailer_id;

  if history_mode = 'allowed'
     and (
       tg_op = 'INSERT'
       or new.price is distinct from old.price
       or new.list_price is distinct from old.list_price
       or new.availability is distinct from old.availability
     ) then
    insert into public.commerce_price_history (offer_id, price, list_price, availability, captured_at)
    values (new.id, new.price, new.list_price, new.availability, coalesce(new.fetched_at, now()));
  end if;
  return new;
end;
$$;
