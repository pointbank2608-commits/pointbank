-- Save new lists and append to existing lists in one transaction.
-- Invoker permissions retain word_lists RLS, free-plan limits and revision triggers.
begin;

create or replace function public.save_study_lists(p_academy_id uuid, p_lists jsonb)
returns setof public.word_lists
language plpgsql security invoker set search_path = '' as $$
declare
  draft jsonb;
  item jsonb;
  target public.word_lists;
  list_id uuid;
  list_kind text;
  merged_items jsonb;
  keys text[];
  ids text[];
  item_key text;
begin
  if auth.uid() is null or p_academy_id is null or p_academy_id is distinct from public.my_academy_id() or not public.is_staff() then
    raise sqlstate '42501' using message = 'study_list_access_denied';
  end if;
  if jsonb_typeof(p_lists) is distinct from 'array' or jsonb_array_length(p_lists) not between 1 and 2 then
    raise exception 'invalid_study_lists';
  end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_lists)) <> jsonb_array_length(p_lists) then
    raise exception 'invalid_study_lists';
  end if;

  -- Lock destinations in a stable order when two lists are saved together.
  for draft in select value from jsonb_array_elements(p_lists) order by value->>'id' loop
    list_id := (draft->>'id')::uuid;
    list_kind := draft->>'kind';
    if list_id is null or list_kind is null or list_kind not in ('word', 'sentence')
      or jsonb_typeof(draft->'items') is distinct from 'array' then
      raise exception 'invalid_study_lists';
    end if;
    for item in select value from jsonb_array_elements(draft->'items') loop
      if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'word') is distinct from 'string'
        or btrim(regexp_replace(item->>'word', '[[:space:]]+', ' ', 'g')) = '' or coalesce(item->>'id', '') = '' then
        raise exception 'invalid_study_items';
      end if;
    end loop;

    select * into target from public.word_lists where id = list_id and academy_id = p_academy_id for update;
    if coalesce((draft->>'append')::boolean, false) then
      if not found or coalesce(target.kind, 'word') <> list_kind then
        raise exception 'study_list_missing';
      end if;
      merged_items := target.items;
      select coalesce(array_agg(jsonb_build_array(
        lower(btrim(regexp_replace(value->>'word', '[[:space:]]+', ' ', 'g'))),
        lower(btrim(regexp_replace(coalesce(value->>'meaning', ''), '[[:space:]]+', ' ', 'g')))
      )::text), '{}'::text[]), coalesce(array_agg(value->>'id'), '{}'::text[])
      into keys, ids from jsonb_array_elements(merged_items);
      for item in select value from jsonb_array_elements(draft->'items') loop
        item_key := jsonb_build_array(
          lower(btrim(regexp_replace(item->>'word', '[[:space:]]+', ' ', 'g'))),
          lower(btrim(regexp_replace(coalesce(item->>'meaning', ''), '[[:space:]]+', ' ', 'g')))
        )::text;
        if item_key = any(keys) or (item->>'id') = any(ids) then continue; end if;
        merged_items := merged_items || jsonb_build_array(item);
        keys := array_append(keys, item_key);
        ids := array_append(ids, item->>'id');
      end loop;
      if merged_items is distinct from target.items then
        update public.word_lists set items = merged_items, updated_at = now()
          where id = list_id and academy_id = p_academy_id returning * into target;
      end if;
    else
      if jsonb_typeof(draft->'name') is distinct from 'string' or btrim(draft->>'name') = '' then
        raise exception 'invalid_study_lists';
      end if;
      insert into public.word_lists (id, academy_id, class_id, created_by, kind, name, items)
        values (list_id, p_academy_id, null, auth.uid(), list_kind, btrim(draft->>'name'), draft->'items')
        on conflict (id) do nothing;
      select * into target from public.word_lists where id = list_id and academy_id = p_academy_id;
      if not found or coalesce(target.kind, 'word') <> list_kind then
        raise exception 'study_list_missing';
      end if;
    end if;
    return next target;
  end loop;
end;
$$;
revoke all on function public.save_study_lists(uuid, jsonb) from public, anon;
grant execute on function public.save_study_lists(uuid, jsonb) to authenticated;

commit;
