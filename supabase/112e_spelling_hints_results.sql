begin;
create or replace function public.hw_block_results(p_assignment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := public.hw_staff_academy(); c uuid;
begin
 select class_id into c from public.homework_assignments where id=p_assignment and academy_id=a;
 if c is null then raise exception 'not_found'; end if;
 perform public.hw_block_academy(c);
 return coalesce((select jsonb_agg(row_to_json(x) order by (x.meta->>'review'='pending') desc nulls last,x.name,x.position) from (
   select t.id attempt_id,i.id item_id,t.student_id,s.name,i.title,i.position,coalesce(ia.meta,'{}') meta,ia.finished_at is not null finished,ia.id is not null started,
     (select count(*) from public.homework_answers ha where ha.attempt_id=t.id and ha.item_id=i.id) answered,
     case when starts_with(i.config->'block'->>'method','guided-final:') then (
       select count(*) from public.homework_answers ha
       where ha.attempt_id=t.id and ha.item_id=i.id and ha.correct
     ) else coalesce(ia.score,0) end first_correct,jsonb_array_length(i.content->'questions') total,coalesce(ia.retry_count,0) retries,
     public.hw_spelling_summary(i,t.student_id,t.id) spelling_hints,
     i.config->'block'->'guidedPractice' = 'true'::jsonb guided_practice,
     case when starts_with(i.config->'block'->>'method','guided-final:') then split_part(i.config->'block'->>'method',':',2) end check_type,
     case when starts_with(i.config->'block'->>'method','guided-final:') then (
       select coalesce(jsonb_agg(jsonb_build_object('word',w.card->>'word','meaning',coalesce(w.card->>'meaning',''),'imageUrl',w.card->>'imageUrl','example',w.card->>'example') order by w.q_index),'[]'::jsonb) from (
         select ha.q_index,i.content->'questions'->ha.q_index->'card' as card
         from public.homework_answers ha
         where ha.attempt_id=t.id and ha.item_id=i.id and ha.correct is false
           and jsonb_typeof(i.content->'questions'->ha.q_index->'card')='object'
         order by ha.q_index limit 5
       ) w
     ) end check_misses,
     (select count(*) from (select distinct on(e.q_index) e.correct from public.learning_events e where e.attempt_id=t.id and e.item_id=i.id and e.event_type in ('answer','retry_answer') order by e.q_index,e.created_at desc,e.id desc) latest where latest.correct) final_correct
   from public.homework_attempts t join public.students s on s.id=t.student_id join public.homework_items i on i.assignment_id=t.assignment_id
   left join public.homework_item_attempts ia on ia.attempt_id=t.id and ia.item_id=i.id
   where t.assignment_id=p_assignment and i.config ? 'block'
 ) x),'[]');
end $$;
commit;
