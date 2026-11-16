begin;

create table public.textbook_books (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (title = btrim(title) and char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (academy_id, created_by, title),
  unique (id, academy_id, created_by)
);

alter table public.textbook_books enable row level security;
revoke all on public.textbook_books from public, anon, authenticated;
grant select, insert on public.textbook_books to authenticated;

create policy textbook_books_read on public.textbook_books for select to authenticated
using (created_by = (select auth.uid()) and academy_id = (select public.my_academy_id()) and (select public.is_staff()));

create policy textbook_books_insert on public.textbook_books for insert to authenticated
with check (created_by = (select auth.uid()) and academy_id = (select public.my_academy_id()) and (select public.is_staff()));

alter table public.textbook_units add column book_id uuid;

-- The existing title groups become rows owned by the same teacher. Unit IDs stay in use
-- by original file paths, saved worksheets, and existing links.
insert into public.textbook_books (academy_id, created_by, title, created_at)
select academy_id, created_by, textbook, max(created_at)
from public.textbook_units
group by academy_id, created_by, textbook;

update public.textbook_units u
set book_id = b.id
from public.textbook_books b
where (u.academy_id, u.created_by, u.textbook) = (b.academy_id, b.created_by, b.title);

alter table public.textbook_units
  alter column book_id set not null,
  add constraint textbook_units_book_fk foreign key (book_id, academy_id, created_by)
    references public.textbook_books (id, academy_id, created_by);
create index textbook_units_book_idx on public.textbook_units (book_id);

-- Resolve the parent inside the existing atomic unit-save RPC, including for
-- older clients that still start at the unit form and send only a title.
create function public.set_textbook_unit_book()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.textbook_books (academy_id, created_by, title)
  values (new.academy_id, new.created_by, new.textbook)
  on conflict (academy_id, created_by, title) do nothing;

  select b.id into strict new.book_id
  from public.textbook_books b
  where (b.academy_id, b.created_by, b.title) = (new.academy_id, new.created_by, new.textbook);
  return new;
end;
$$;
revoke all on function public.set_textbook_unit_book() from public, anon, authenticated;

create trigger textbook_units_assign_book
before insert on public.textbook_units
for each row execute function public.set_textbook_unit_book();

notify pgrst, 'reload schema';

commit;
