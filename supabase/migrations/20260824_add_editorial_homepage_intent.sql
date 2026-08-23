alter table public.editorial_workflow
add column if not exists homepage_intent text not null default 'inherit'
check (homepage_intent in ('inherit','regular','lead','secondary-top','secondary-bottom'));

create index if not exists editorial_workflow_homepage_intent_idx
on public.editorial_workflow (homepage_intent)
where homepage_intent <> 'inherit';
