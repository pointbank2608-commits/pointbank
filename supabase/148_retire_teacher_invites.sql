begin;

drop function if exists public.join_academy_as_teacher(text, text);
drop function if exists public.rotate_invite_code();
drop function if exists public.delete_my_teacher_account();

-- Each teaching space has one account holder. Admin and student roles are independent.
create unique index if not exists profiles_one_owner_per_academy
  on public.profiles (academy_id) where role = 'owner';
alter table public.profiles drop constraint if exists profiles_no_invited_teacher;
alter table public.profiles add constraint profiles_no_invited_teacher check (role <> 'teacher');

-- Older admin reports still select this column. New accounts need no invite code.
alter table public.academies
  alter column invite_code drop default,
  alter column invite_code drop not null;

-- Preserve past invoices while ending teacher counts on future billing records.
drop trigger if exists billing_history_teacher_count on public.billing_history;
drop function if exists public.snapshot_billing_teacher_count();

commit;
