create table if not exists public.editorial_workflow (
  article_id uuid primary key references public.articles(id) on delete cascade,
  workflow_state text not null default 'drafting' check (workflow_state in ('idea','reporting','drafting','editing','ready','hold')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assignee_name text not null default '',
  verification_status text not null default 'not_required' check (verification_status in ('not_required','sourcing','reported','verified')),
  source_count smallint not null default 0 check (source_count >= 0),
  source_notes text not null default '',
  internal_notes text not null default '',
  due_at timestamptz,
  reviewed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists editorial_workflow_state_idx on public.editorial_workflow (workflow_state);
create index if not exists editorial_workflow_priority_idx on public.editorial_workflow (priority);
create index if not exists editorial_workflow_due_idx on public.editorial_workflow (due_at) where due_at is not null;

alter table public.editorial_workflow enable row level security;
revoke all on table public.editorial_workflow from public, anon, authenticated;
grant select, insert, update, delete on table public.editorial_workflow to authenticated;

drop policy if exists "Editors can read editorial workflow" on public.editorial_workflow;
create policy "Editors can read editorial workflow"
on public.editorial_workflow for select
to authenticated
using (
  exists (
    select 1 from public.editor_profiles ep
    where ep.user_id = (select auth.uid())
      and ep.role = any (array['editor'::text,'admin'::text])
  )
);

drop policy if exists "Editors can create editorial workflow" on public.editorial_workflow;
create policy "Editors can create editorial workflow"
on public.editorial_workflow for insert
to authenticated
with check (
  exists (
    select 1 from public.editor_profiles ep
    where ep.user_id = (select auth.uid())
      and ep.role = any (array['editor'::text,'admin'::text])
  )
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

drop policy if exists "Editors can update editorial workflow" on public.editorial_workflow;
create policy "Editors can update editorial workflow"
on public.editorial_workflow for update
to authenticated
using (
  exists (
    select 1 from public.editor_profiles ep
    where ep.user_id = (select auth.uid())
      and ep.role = any (array['editor'::text,'admin'::text])
  )
)
with check (
  exists (
    select 1 from public.editor_profiles ep
    where ep.user_id = (select auth.uid())
      and ep.role = any (array['editor'::text,'admin'::text])
  )
  and updated_by = (select auth.uid())
);

drop policy if exists "Editors can delete editorial workflow" on public.editorial_workflow;
create policy "Editors can delete editorial workflow"
on public.editorial_workflow for delete
to authenticated
using (
  exists (
    select 1 from public.editor_profiles ep
    where ep.user_id = (select auth.uid())
      and ep.role = any (array['editor'::text,'admin'::text])
  )
);

drop trigger if exists editorial_workflow_set_updated_at on public.editorial_workflow;
create trigger editorial_workflow_set_updated_at
before update on public.editorial_workflow
for each row execute function public.set_updated_at();
