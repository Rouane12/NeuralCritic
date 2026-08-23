alter table public.articles
add column if not exists commercial_meta jsonb not null default '{}'::jsonb;

comment on column public.articles.commercial_meta is
  'Public commercial disclosure metadata for editorial, affiliate-supported, or sponsored stories.';
