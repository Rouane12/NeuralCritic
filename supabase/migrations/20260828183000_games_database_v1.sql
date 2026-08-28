-- Games Database V1
-- Canonical game identities and platform/region release records.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  sort_title text,
  summary text not null default '',
  release_status text not null default 'released' check (release_status in ('announced','dated','released','delayed','cancelled')),
  primary_release_date date,
  developer text not null default '',
  publisher text not null default '',
  franchise text not null default '',
  series text not null default '',
  genres text[] not null default '{}',
  platforms text[] not null default '{}',
  cover_image_url text not null default '',
  cover_image_alt text not null default '',
  official_url text not null default '',
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
  region text not null default 'worldwide',
  release_date date,
  release_window text not null default '',
  status text not null default 'released' check (status in ('announced','dated','released','delayed','cancelled')),
  source_name text not null default '',
  source_url text not null default '',
  metadata jsonb not null default '{}'::jsonb,
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

alter table public.games enable row level security;
alter table public.game_releases enable row level security;

create policy "Public can read games" on public.games for select using (true);
create policy "Public can read game releases" on public.game_releases for select using (true);
