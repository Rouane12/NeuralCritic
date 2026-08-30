-- Harden Commerce Price Intelligence public-read policies.

revoke usage, select on sequence public.commerce_price_history_id_seq from anon, authenticated;

drop policy if exists "Public can read commerce offers" on public.commerce_offers;
create policy "Public can read commerce offers" on public.commerce_offers
for select to anon, authenticated
using (
  exists (
    select 1 from public.commerce_products p
    where p.id = commerce_offers.product_id and p.active = true
  )
  and exists (
    select 1 from public.commerce_retailers r
    where r.id = commerce_offers.retailer_id and r.active = true
  )
);

drop policy if exists "Public can read commerce price history" on public.commerce_price_history;
create policy "Public can read commerce price history" on public.commerce_price_history
for select to anon, authenticated
using (
  exists (
    select 1
    from public.commerce_offers o
    join public.commerce_products p on p.id = o.product_id and p.active = true
    join public.commerce_retailers r on r.id = o.retailer_id and r.active = true
    where o.id = commerce_price_history.offer_id
  )
);

drop policy if exists "Public can read article commerce links" on public.commerce_article_products;
create policy "Public can read article commerce links" on public.commerce_article_products
for select to anon, authenticated
using (
  exists (
    select 1 from public.commerce_products p
    where p.id = commerce_article_products.product_id and p.active = true
  )
  and exists (
    select 1 from public.articles a
    where a.id = commerce_article_products.article_id
      and a.status = 'published'
      and a.published_at <= now()
  )
);
