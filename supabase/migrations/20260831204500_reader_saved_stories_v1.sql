create table if not exists public.reader_saved_stories (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_slug text not null check (length(article_slug) between 1 and 180),
  created_at timestamptz not null default now(),
  primary key (user_id, article_slug)
);

create index if not exists reader_saved_stories_user_created_idx
  on public.reader_saved_stories (user_id, created_at desc);

alter table public.reader_saved_stories enable row level security;

revoke all on table public.reader_saved_stories from anon;
revoke all on table public.reader_saved_stories from authenticated;
grant select, insert, delete on table public.reader_saved_stories to authenticated;

drop policy if exists "Readers can view their saved stories" on public.reader_saved_stories;
create policy "Readers can view their saved stories"
  on public.reader_saved_stories for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Readers can save stories" on public.reader_saved_stories;
create policy "Readers can save stories"
  on public.reader_saved_stories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Readers can remove saved stories" on public.reader_saved_stories;
create policy "Readers can remove saved stories"
  on public.reader_saved_stories for delete
  to authenticated
  using ((select auth.uid()) = user_id);
