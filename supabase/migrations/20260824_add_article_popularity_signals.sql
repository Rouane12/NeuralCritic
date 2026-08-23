create table if not exists public.article_view_daily (
  article_slug text not null references public.articles(slug) on update cascade on delete cascade,
  view_date date not null default (timezone('utc', now())::date),
  view_count bigint not null default 0 check (view_count >= 0),
  last_view_at timestamptz not null default now(),
  primary key (article_slug, view_date)
);

create index if not exists article_view_daily_date_idx
  on public.article_view_daily (view_date desc);

alter table public.article_view_daily enable row level security;
revoke all on table public.article_view_daily from anon, authenticated;

create or replace function public.record_article_view(p_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.article_view_daily (article_slug, view_date, view_count, last_view_at)
  select
    a.slug,
    timezone('utc', now())::date,
    1,
    now()
  from public.articles as a
  where a.slug = p_slug
    and a.status = 'published'
    and a.published_at <= now()
  on conflict (article_slug, view_date)
  do update set
    view_count = public.article_view_daily.view_count + 1,
    last_view_at = excluded.last_view_at;
end;
$$;

create or replace function public.get_article_popularity(p_days integer default 7)
returns table (
  article_slug text,
  views_today bigint,
  views_window bigint,
  last_view_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select
      timezone('utc', now())::date as today,
      least(greatest(coalesce(p_days, 7), 1), 30) as days
  )
  select
    v.article_slug,
    coalesce(sum(v.view_count) filter (where v.view_date = b.today), 0)::bigint as views_today,
    coalesce(sum(v.view_count), 0)::bigint as views_window,
    max(v.last_view_at) as last_view_at
  from public.article_view_daily as v
  join public.articles as a on a.slug = v.article_slug
  cross join bounds as b
  where a.status = 'published'
    and a.published_at <= now()
    and v.view_date >= b.today - (b.days - 1)
  group by v.article_slug, b.today;
$$;

revoke all on function public.record_article_view(text) from public;
revoke all on function public.get_article_popularity(integer) from public;
grant execute on function public.record_article_view(text) to anon, authenticated;
grant execute on function public.get_article_popularity(integer) to anon, authenticated;
