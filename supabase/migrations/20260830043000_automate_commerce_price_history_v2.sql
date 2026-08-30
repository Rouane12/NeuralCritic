-- Keep commerce timestamps fresh and record offer history automatically.

drop trigger if exists commerce_retailers_set_updated_at on public.commerce_retailers;
create trigger commerce_retailers_set_updated_at
before update on public.commerce_retailers
for each row execute function public.set_updated_at();

drop trigger if exists commerce_products_set_updated_at on public.commerce_products;
create trigger commerce_products_set_updated_at
before update on public.commerce_products
for each row execute function public.set_updated_at();

drop trigger if exists commerce_offers_set_updated_at on public.commerce_offers;
create trigger commerce_offers_set_updated_at
before update on public.commerce_offers
for each row execute function public.set_updated_at();

create or replace function public.capture_commerce_offer_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.price is distinct from old.price
     or new.list_price is distinct from old.list_price
     or new.availability is distinct from old.availability then
    insert into public.commerce_price_history (offer_id, price, list_price, availability, captured_at)
    values (new.id, new.price, new.list_price, new.availability, coalesce(new.fetched_at, now()));
  end if;
  return new;
end;
$$;

drop trigger if exists commerce_offers_capture_history on public.commerce_offers;
create trigger commerce_offers_capture_history
after insert or update of price, list_price, availability on public.commerce_offers
for each row execute function public.capture_commerce_offer_history();
