create index if not exists editorial_workflow_created_by_idx
  on public.editorial_workflow (created_by);

create index if not exists editorial_workflow_updated_by_idx
  on public.editorial_workflow (updated_by);
