-- Word-list transfers run under the teacher's permissions and update both locked rows together.
begin;
create or replace function public.transfer_word_list_items(p_source uuid, p_target uuid, p_item_ids text[], p_move boolean)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  academy uuid := public.my_academy_id();
  list_row public.word_lists;
  source_items jsonb;
  target_items jsonb;
  merged_items jsonb := '[]';
  transferred text[] := '{}';
  grp record;
  entry jsonb;
  merged jsonb;
  senses text[];
  sense_keys text[];
  sense text;
  sense_key text;
  changed boolean;
  idx integer;
begin
  if auth.uid() is null or academy is null or not public.is_staff() then
    raise sqlstate '42501' using message = 'study_list_access_denied';
  end if;
  if p_source = p_target or p_move is null or coalesce(cardinality(p_item_ids), 0) = 0 then
    raise exception 'invalid_study_lists';
  end if;
  for list_row in select * from public.word_lists
    where id in (p_source, p_target) and academy_id = academy and coalesce(kind, 'word') = 'word'
    order by id for update
  loop
    if list_row.id = p_source then source_items := list_row.items; else target_items := list_row.items; end if;
  end loop;
  if source_items is null or target_items is null then raise exception 'study_list_missing'; end if;

  for grp in
    with entries as (
      select value, ordinality as pos, false as incoming from jsonb_array_elements(target_items) with ordinality
      union all
      select value, ordinality + jsonb_array_length(target_items), true from jsonb_array_elements(source_items) with ordinality
        where value->>'id' = any(p_item_ids)
    ), keyed as (
      select *, lower(btrim(regexp_replace(value->>'word', '[[:space:]]+', ' ', 'g'))) as spelling,
        nullif(regexp_replace(btrim(value->>'image_url'), '^(/(word-bank-images|phonics-images)/.+)\.png$', '\1.webp'), '') as image
      from entries
    ), pictures as (
      select spelling, case when count(distinct image) = 1 then min(image) end as sole_image
      from keyed group by spelling having bool_or(incoming)
    )
    -- For ambiguous pictureless senses, keep a separate text entry. Group only transferred spellings.
    select array_agg(value order by pos) as entries, count(*) filter (where not incoming) as existing,
      pictures.spelling is not null as touched, coalesce(image, sole_image) as picture
    from keyed left join pictures using (spelling)
    group by pictures.spelling, coalesce(image, sole_image), case when pictures.spelling is null then pos end
    order by min(pos)
  loop
    if not grp.touched then
      merged_items := merged_items || jsonb_build_array(grp.entries[1]);
      continue;
    end if;
    merged := grp.entries[1];
    if grp.existing = 0 and (not p_move or exists (
      select 1 from jsonb_array_elements(target_items) where value->>'id' = merged->>'id'
    )) then
      merged := merged || jsonb_build_object('id', gen_random_uuid());
    end if;
    senses := '{}'; sense_keys := '{}';
    for idx in 1..cardinality(grp.entries) loop
      entry := grp.entries[idx];
      changed := idx = 1;
      if nullif(btrim(merged->>'image_url'), '') is null and nullif(btrim(entry->>'image_url'), '') is not null then
        merged := merged || jsonb_build_object('image_url', entry->>'image_url');
        changed := true;
      end if;
      -- Preserve commas inside a teacher's definition. Only the displayed sense separator splits meanings.
      foreach sense in array string_to_array(coalesce(entry->>'meaning', ''), ' / ') loop
        sense := btrim(sense);
        sense_key := lower(btrim(regexp_replace(sense, '[[:space:]]+', ' ', 'g')));
        if sense_key <> '' and not (sense_key = any(sense_keys)) then
          senses := array_append(senses, sense);
          sense_keys := array_append(sense_keys, sense_key);
          changed := true;
        end if;
      end loop;
      if idx > grp.existing and changed then transferred := array_append(transferred, entry->>'id'); end if;
    end loop;
    merged := merged || jsonb_build_object('meaning', array_to_string(senses, ' / '));
    merged_items := merged_items || jsonb_build_array(merged);
  end loop;

  if merged_items is distinct from target_items then
    update public.word_lists set items = merged_items, updated_at = now() where id = p_target and academy_id = academy;
    if not found then raise exception 'study_list_missing'; end if;
  end if;
  if p_move and cardinality(transferred) > 0 then
    update public.word_lists set items = (select coalesce(jsonb_agg(value order by ordinality), '[]'::jsonb)
      from jsonb_array_elements(source_items) with ordinality where (value->>'id' = any(transferred)) is not true),
      updated_at = now() where id = p_source and academy_id = academy;
    if not found then raise exception 'study_list_missing'; end if;
  end if;
  return cardinality(transferred);
end;
$$;
revoke all on function public.transfer_word_list_items(uuid, uuid, text[], boolean) from public, anon;
grant execute on function public.transfer_word_list_items(uuid, uuid, text[], boolean) to authenticated;
commit;
