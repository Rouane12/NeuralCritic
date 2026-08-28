-- Games Database V1
-- Canonical game identities and platform/region release records.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  sort_title text,
  summary text not null default '',
  release_status text not null default 'released' check (release_status in ('announced','coming_soon','released','delayed','cancelled','early_access')),
  primary_release_date date,
  developer text,
  publisher text,
  franchise text,
  series text,
  genres text[] not null default '{}',
  platforms text[] not null default '{}',
  cover_image_url text,
  cover_image_alt text,
  official_url text,
  neural_critic_score numeric(3,1) check (neural_critic_score between 0 and 10),
  score_article_slug text,
  featured boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_releases (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  platform text not null,
  region text not null default 'global',
  release_date date,
  release_year integer,
  release_month integer check (release_month is null or release_month between 1 and 12),
  release_window text,
  status text not null default 'confirmed' check (status in ('confirmed','estimated','tba','delayed','cancelled')),
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, platform, region)
);

create index if not exists games_primary_release_date_idx on public.games(primary_release_date);
create index if not exists games_release_status_idx on public.games(release_status);
create index if not exists games_franchise_idx on public.games(franchise);
create index if not exists games_series_idx on public.games(series);
create index if not exists game_releases_date_idx on public.game_releases(release_date);
create index if not exists game_releases_platform_idx on public.game_releases(platform);

create or replace function public.set_games_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at before update on public.games
for each row execute function public.set_games_updated_at();

drop trigger if exists game_releases_set_updated_at on public.game_releases;
create trigger game_releases_set_updated_at before update on public.game_releases
for each row execute function public.set_games_updated_at();

alter table public.games enable row level security;
alter table public.game_releases enable row level security;

drop policy if exists "Public can read games" on public.games;
create policy "Public can read games" on public.games for select using (true);

drop policy if exists "Public can read game releases" on public.game_releases;
create policy "Public can read game releases" on public.game_releases for select using (true);
