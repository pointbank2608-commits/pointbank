begin;

-- Catalog entries can be created before any material is attached.
create function public.create_textbook_catalog_unit(p_id uuid, p_book_id uuid, p_title text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_book public.textbook_books;
  v_unit public.textbook_units;
begin
  select * into v_book from public.textbook_books
  where id = p_book_id and created_by = v_user and academy_id = public.my_academy_id();
  if not found or public.is_staff() is not true then
    raise sqlstate '42501' using message = 'textbook_access_denied';
  end if;
  if p_id is null or coalesce(char_length(btrim(p_title)), 0) not between 1 and 120 then
    raise sqlstate '22023' using message = 'invalid_textbook';
  end if;

  insert into public.textbook_units (id, book_id, academy_id, created_by, textbook, title, files)
  values (p_id, v_book.id, v_book.academy_id, v_user, v_book.title, btrim(p_title), '[]'::jsonb)
  on conflict (id) do nothing;

  select * into v_unit from public.textbook_units
  where id = p_id and book_id = v_book.id and academy_id = v_book.academy_id and created_by = v_user;
  if not found then
    raise sqlstate '42501' using message = 'textbook_access_denied';
  end if;
  return to_jsonb(v_unit);
end;
$$;

revoke all on function public.create_textbook_catalog_unit(uuid, uuid, text) from public, anon;
grant execute on function public.create_textbook_catalog_unit(uuid, uuid, text) to authenticated;
notify pgrst, 'reload schema';

commit;
