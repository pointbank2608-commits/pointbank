begin;

create table public.textbook_units (
  id uuid primary key,
  academy_id uuid not null references public.academies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  textbook text not null check (char_length(textbook) between 1 and 120),
  title text not null check (char_length(title) between 1 and 120),
  files jsonb not null check (jsonb_typeof(files) = 'array'),
  word_list_id uuid references public.word_lists(id) on delete set null,
  sentence_list_id uuid references public.word_lists(id) on delete set null,
  created_at timestamptz not null default now()
);
create index textbook_units_owner_idx on public.textbook_units (academy_id, created_by, created_at desc);

create table public.textbook_worksheets (
  id uuid primary key,
  unit_id uuid not null references public.textbook_units(id) on delete cascade,
  document jsonb not null check (
    jsonb_typeof(document) = 'object' and
    document->>'schema' is not distinct from 'classbank-worksheet-v1' and
    octet_length(document::text) <= 1048576
  ),
  updated_at timestamptz not null default now()
);
create index textbook_worksheets_unit_idx on public.textbook_worksheets (unit_id, updated_at desc);

alter table public.textbook_units enable row level security;
alter table public.textbook_worksheets enable row level security;
revoke all on public.textbook_units, public.textbook_worksheets from public, anon, authenticated;
grant select on public.textbook_units to authenticated;
grant select, insert, update on public.textbook_worksheets to authenticated;

create policy textbook_units_read on public.textbook_units for select to authenticated
using (created_by = (select auth.uid()) and academy_id = (select public.my_academy_id()) and (select public.is_staff()));

create policy textbook_worksheets_read on public.textbook_worksheets for select to authenticated
using (exists (select 1 from public.textbook_units u where u.id = unit_id));
create policy textbook_worksheets_insert on public.textbook_worksheets for insert to authenticated
with check (exists (select 1 from public.textbook_units u where u.id = unit_id));
create policy textbook_worksheets_update on public.textbook_worksheets for update to authenticated
using (exists (select 1 from public.textbook_units u where u.id = unit_id))
with check (exists (select 1 from public.textbook_units u where u.id = unit_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('textbook-originals', 'textbook-originals', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp']);

create policy textbook_originals_access on storage.objects for all to authenticated
using (bucket_id = 'textbook-originals' and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] = (select public.my_academy_id())::text and (select public.is_staff()))
with check (bucket_id = 'textbook-originals' and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] = (select public.my_academy_id())::text and (select public.is_staff()));

-- One transaction publishes the reviewed lists and their unit. Repeating a request
-- with the same client-issued unit ID returns the original result.
create function public.save_textbook_unit(
  p_id uuid, p_academy_id uuid, p_textbook text, p_title text, p_files jsonb,
  p_words jsonb, p_sentences jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_prefix text := v_user::text || '/' || p_academy_id::text || '/' || p_id::text || '/';
  v_unit public.textbook_units;
  v_word_id uuid;
  v_sentence_id uuid;
  v_file jsonb;
  v_items jsonb;
  v_item jsonb;
begin
  if v_user is null or p_academy_id is null or p_id is null
     or p_academy_id is distinct from public.my_academy_id() or not public.is_staff() then
    raise sqlstate '42501' using message = 'textbook_access_denied';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text, 123));
  select * into v_unit from public.textbook_units where id = p_id;
  if found then
    if v_unit.created_by <> v_user or v_unit.academy_id <> p_academy_id then
      raise sqlstate '42501' using message = 'textbook_access_denied';
    end if;
    return to_jsonb(v_unit);
  end if;

  if coalesce(char_length(btrim(p_textbook)), 0) not between 1 and 120
     or coalesce(char_length(btrim(p_title)), 0) not between 1 and 120
     or jsonb_typeof(p_files) is distinct from 'array' then
    raise sqlstate '22023' using message = 'invalid_textbook';
  end if;
  if jsonb_array_length(p_files) not between 1 and 6 then
    raise sqlstate '22023' using message = 'invalid_textbook_files';
  end if;
  for v_file in select value from jsonb_array_elements(p_files) loop
    if left(v_file->>'path', length(v_prefix)) is distinct from v_prefix
       or coalesce(char_length(v_file->>'name'), 0) not between 1 and 240
       or coalesce(v_file->>'mime', '') not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
       or not exists (
         select 1 from storage.objects o where o.bucket_id = 'textbook-originals'
           and o.name = v_file->>'path' and (o.metadata->>'mimetype') = v_file->>'mime'
       ) then
      raise sqlstate '22023' using message = 'invalid_textbook_files';
    end if;
  end loop;

  foreach v_items in array array[p_words, p_sentences] loop
    if jsonb_typeof(v_items) is distinct from 'array' then
      raise sqlstate '22023' using message = 'invalid_textbook_items';
    end if;
    if jsonb_array_length(v_items) > 40 or octet_length(v_items::text) > 100000 then
      raise sqlstate '22023' using message = 'invalid_textbook_items';
    end if;
    for v_item in select value from jsonb_array_elements(v_items) loop
      if jsonb_typeof(v_item->'id') is distinct from 'string'
         or coalesce(char_length(btrim(v_item->>'word')),0) not between 1 and 100
         or coalesce(char_length(btrim(v_item->>'meaning')),0) not between 1 and 160 then
        raise sqlstate '22023' using message = 'invalid_textbook_items';
      end if;
    end loop;
  end loop;

  if jsonb_array_length(p_words) > 0 then
    insert into public.word_lists (academy_id, name, items, created_by, kind)
    values (p_academy_id, left(btrim(p_textbook), 90) || ' · ' || left(btrim(p_title), 90), p_words, v_user, 'word')
    returning id into v_word_id;
  end if;
  if jsonb_array_length(p_sentences) > 0 then
    insert into public.word_lists (academy_id, name, items, created_by, kind)
    values (p_academy_id, left(btrim(p_textbook), 90) || ' · ' || left(btrim(p_title), 90), p_sentences, v_user, 'sentence')
    returning id into v_sentence_id;
  end if;
  insert into public.textbook_units (id, academy_id, created_by, textbook, title, files, word_list_id, sentence_list_id)
  values (p_id, p_academy_id, v_user, btrim(p_textbook), btrim(p_title), p_files, v_word_id, v_sentence_id)
  returning * into v_unit;
  return to_jsonb(v_unit);
end;
$$;
revoke all on function public.save_textbook_unit(uuid,uuid,text,text,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.save_textbook_unit(uuid,uuid,text,text,jsonb,jsonb,jsonb) to authenticated;

create schema if not exists private;
create table private.textbook_extraction_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  requests int not null
);
alter table private.textbook_extraction_limits enable row level security;
revoke all on private.textbook_extraction_limits from public, anon, authenticated;

create function public.reserve_textbook_extraction(p_academy_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := now();
begin
  if auth.uid() is null or p_academy_id is null
     or p_academy_id is distinct from public.my_academy_id() or not public.is_staff() then
    raise sqlstate '42501' using message = 'textbook_access_denied';
  end if;
  insert into private.textbook_extraction_limits as limits (user_id, window_start, requests)
  values (auth.uid(), v_now, 1)
  on conflict (user_id) do update
    set window_start = case when limits.window_start <= v_now - interval '1 hour' then v_now else limits.window_start end,
        requests = case when limits.window_start <= v_now - interval '1 hour' then 1 else limits.requests + 1 end
    where limits.window_start <= v_now - interval '1 hour' or limits.requests < 20;
  return found;
end;
$$;
revoke all on function public.reserve_textbook_extraction(uuid) from public, anon;
grant execute on function public.reserve_textbook_extraction(uuid) to authenticated;

commit;
