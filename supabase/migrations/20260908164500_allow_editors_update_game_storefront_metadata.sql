-- Allow authenticated Neural Critic editors to manage canonical game metadata
-- from Editorial Studio without granting write access to the rest of the game row.

grant update (metadata) on public.games to authenticated;

drop policy if exists "Editors can update game metadata" on public.games;
create policy "Editors can update game metadata"
on public.games
for update
to authenticated
using (
  exists (
    select 1
    from public.editor_profiles ep
    where ep.user_id = (select auth.uid())
      and ep.role = any (array['editor'::text, 'admin'::text])
  )
)
with check (
  exists (
    select 1
    from public.editor_profiles ep
    where ep.user_id = (select auth.uid())
      and ep.role = any (array['editor'::text, 'admin'::text])
  )
);
