-- Preserve the teacher count for new billing records. Older records have no snapshot.
alter table public.billing_history add column if not exists teacher_count integer;

create or replace function public.snapshot_billing_teacher_count()
returns trigger language plpgsql set search_path = '' as $$
begin
  select count(*)::integer into new.teacher_count
  from public.profiles where academy_id = new.academy_id and role in ('owner', 'teacher');
  return new;
end;
$$;

create or replace trigger billing_history_teacher_count before insert on public.billing_history
for each row execute function public.snapshot_billing_teacher_count();
