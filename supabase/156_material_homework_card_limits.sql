-- One recording is stored under one item ID. A material activity can thus contain
-- many physical rows, while the teacher and student see one activity group.
begin;
do $$ begin
  if to_regprocedure('public.hw_validate_items_before_material_cards(jsonb,boolean)') is null then
    alter function public.hw_validate_items(jsonb,boolean) rename to hw_validate_items_before_material_cards;
  end if;
end $$;

create or replace function public.hw_validate_items(p_items jsonb, p_draft boolean default false) returns void
language plpgsql immutable set search_path = public, pg_temp as $$
declare chunk jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or octet_length(p_items::text) > 1000000 then
    raise exception 'bad_items';
  end if;
  if jsonb_array_length(p_items) <= 60 then
    perform public.hw_validate_items_before_material_cards(p_items,p_draft);
    return;
  end if;
  -- Existing assignments and editors keep their original 60-item limit.
  -- A teacher can append a legacy activity to a grouped material assignment.
  -- Each legacy row still consumes one whole activity regardless of any groupKey it carries.
  if (select count(distinct case
       when coalesce(i#>>'{config,block,groupKey}','') <> '' and
         (i#>>'{config,block,method}' in ('material:learn','material:choice','material:say','material:spell',
           'material:listen','material:repeat','material:hide','material:order','material:write','material:sceneWords',
           'material:watch','material:echo','material:shadow','material:dub')
          or (i#>>'{config,block,groupKey}'='material-final' and i#>>'{config,block,method}' like 'guided-final:%'))
       then 'group:' || (i#>>'{config,block,groupKey}') else 'row:' || ord::text end)
      from jsonb_array_elements(p_items) with ordinality t(i,ord)) > 60 then
    raise exception 'no_items';
  end if;
  for chunk in
    select jsonb_agg(i order by ord)
    from jsonb_array_elements(p_items) with ordinality t(i,ord)
    group by (ord-1)/60
  loop
    perform public.hw_validate_items_before_material_cards(chunk,p_draft);
  end loop;
end $$;
revoke all on function public.hw_validate_items(jsonb,boolean),
  public.hw_validate_items_before_material_cards(jsonb,boolean) from public,anon,authenticated;
commit;
