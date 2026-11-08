begin;
create or replace function public.hw_spelling_summary(i public.homework_items,student uuid,attempt uuid) returns jsonb
language sql stable set search_path=public as $$
 select case when i.config #> '{block,spellingHints}' is not null then jsonb_build_object(
   'allowed',public.hw_spelling_allowance(i.config,student),
   'questions',(select coalesce(jsonb_agg(jsonb_build_object(
     'index',q.ord,'prompt',q.value->>'prompt','allowed',
     least(public.hw_spelling_allowance(i.config,student),case when length(q.value->>'correct')<3 then 1 else 2 end),
     'used',coalesce(h.used,0),'correct',a.correct,
     'word',case when a.q_index is not null then q.value->>'word' end
   ) order by q.ord),'[]'::jsonb)
   from jsonb_array_elements(i.content->'questions') with ordinality q(value,ord)
   left join public.homework_answers a on a.attempt_id=attempt and a.item_id=i.id and a.q_index=q.ord-1
   left join public.homework_spelling_hints h on h.attempt_id=attempt and h.item_id=i.id and h.q_index=q.ord-1
   where q.value->'guidedSpelling'='true'::jsonb)) end
$$;
revoke all on function public.hw_spelling_summary(public.homework_items,uuid,uuid) from public,anon,authenticated;
commit;
