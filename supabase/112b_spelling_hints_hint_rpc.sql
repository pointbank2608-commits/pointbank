begin;
create or replace function public.hw_spelling_hint(p_token uuid,p_item uuid,p_index int,p_level int) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.homework_attempts; i public.homework_items; q jsonb; target text; allowed int; used_level int;
begin
 if p_index is null or p_index<0 or p_level is null or p_level not between 0 and 2 then raise exception 'bad_hint'; end if;
 t := public.hw_attempt_for(p_token,p_level=0);
 if p_level>0 then
  select * into t from public.homework_attempts where id=t.id for update;
 end if;
 select * into i from public.homework_items where id=p_item and assignment_id=t.assignment_id;
 q := i.content->'questions'->p_index;
 target := q->>'correct';
 if i.id is null or i.config #> '{block,spellingHints}' is null or starts_with(coalesce(i.config #>> '{block,method}',''),'guided-final:')
    or q->'guidedSpelling' is distinct from 'true'::jsonb or coalesce(target,'') !~ '^[A-Za-z][A-Za-z'' -]{1,20}$' then
  raise exception 'not_found';
 end if;
 allowed := public.hw_spelling_allowance(i.config,t.student_id);
 if length(target)<3 then allowed:=least(allowed,1); end if;
 select coalesce(max(h.used),0) into used_level from public.homework_spelling_hints h
 where h.attempt_id=t.id and h.item_id=i.id and h.q_index=p_index;
 if p_level>0 then
  if p_level>allowed or p_level>used_level+1 then raise exception 'hint_not_allowed'; end if;
  if t.finished_at is not null or exists(select 1 from public.homework_answers h where h.attempt_id=t.id and h.item_id=i.id and h.q_index=p_index)
     or exists(select 1 from public.homework_items earlier where earlier.assignment_id=t.assignment_id and earlier.position<i.position
         and not exists(select 1 from public.homework_item_attempts a where a.attempt_id=t.id and a.item_id=earlier.id and a.finished_at is not null))
     or (select count(*) from public.homework_answers h where h.attempt_id=t.id and h.item_id=i.id and h.q_index<p_index)<p_index then
   raise exception 'hint_not_available';
  end if;
  if p_level>used_level then
   insert into public.homework_spelling_hints(attempt_id,item_id,q_index,used,partial_revealed_at)
   values(t.id,i.id,p_index,p_level,case when p_level=2 then clock_timestamp() end)
   on conflict (attempt_id,item_id,q_index) do update set used=excluded.used,partial_revealed_at=excluded.partial_revealed_at;
   used_level:=p_level;
  end if;
 end if;
 return jsonb_build_object('allowed',allowed,'used',used_level,'mask',coalesce(public.hw_spelling_mask(target,used_level),''));
end $$;
revoke all on function public.hw_spelling_hint(uuid,uuid,int,int) from public;
grant execute on function public.hw_spelling_hint(uuid,uuid,int,int) to anon,authenticated;
commit;
