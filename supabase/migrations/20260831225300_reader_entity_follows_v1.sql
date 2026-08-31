create table if not exists public.reader_entity_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_slug text not null,
  entity_name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_slug),
  constraint reader_entity_follows_type_check check (entity_type in ('game','series','franchise')),
  constraint reader_entity_follows_slug_check check (char_length(entity_slug) between 1 and 160),
  constraint reader_entity_follows_name_check check (char_length(entity_name) between 1 and 200)
);

alter table public.reader_entity_follows enable row level security;

revoke all on table public.reader_entity_follows from anon;
grant select, insert, delete on table public.reader_entity_follows to authenticated;

create index if not exists reader_entity_follows_user_created_idx
  on public.reader_entity_follows (user_id, created_at desc);

drop policy if exists "Readers can view their own entity follows" on public.reader_entity_follows;
create policy "Readers can view their own entity follows"
  on public.reader_entity_follows
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Readers can follow entities for themselves" on public.reader_entity_follows;
create policy "Readers can follow entities for themselves"
  on public.reader_entity_follows
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Readers can unfollow their own entities" on public.reader_entity_follows;
create policy "Readers can unfollow their own entities"
  on public.reader_entity_follows
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
