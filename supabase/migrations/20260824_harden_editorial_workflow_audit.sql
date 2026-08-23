create schema if not exists private;
revoke all on schema private from public;

create or replace function private.set_editorial_workflow_audit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' then
      new.created_by = (select auth.uid());
    else
      new.created_by = old.created_by;
    end if;
    new.updated_by = (select auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists editorial_workflow_audit_fields on public.editorial_workflow;
create trigger editorial_workflow_audit_fields
before insert or update on public.editorial_workflow
for each row execute function private.set_editorial_workflow_audit();
