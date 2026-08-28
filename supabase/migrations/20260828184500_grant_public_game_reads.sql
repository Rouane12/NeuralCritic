-- Games Database V1 public reader grants.
-- RLS policies alone do not grant table SELECT privileges to Supabase anon/authenticated roles.

grant select on table public.games to anon, authenticated;
grant select on table public.game_releases to anon, authenticated;
