begin;

create table if not exists public.homework_spelling_hints (
  attempt_id uuid not null references public.homework_attempts(id) on delete cascade,
  item_id uuid not null references public.homework_items(id) on delete cascade,
  q_index integer not null check (q_index >= 0),
  used smallint not null check (used in (1,2)),
  first_revealed_at timestamptz not null default now(),
  partial_revealed_at timestamptz,
  primary key (attempt_id,item_id,q_index)
);
alter table public.homework_spelling_hints enable row level security;
revoke all on public.homework_spelling_hints from public,anon,authenticated;

create or replace function public.hw_spelling_allowance(config jsonb, student uuid) returns int
language sql immutable set search_path=pg_catalog as $$
 select case coalesce(config #>> array['block','spellingHints','overrides',student::text],
                      config #>> '{block,spellingHints,defaultLevel}')
        when '1' then 1 when '2' then 2 else 0 end
$$;
revoke all on function public.hw_spelling_allowance(jsonb,uuid) from public,anon,authenticated;

create or replace function public.hw_spelling_hint(p_token uuid,p_item uuid,p_index int,p_level int) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.homework_attempts; i public.homework_items; q jsonb; target text; allowed int; used_level int; hint_mask text;
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
 if used_level>0 then
  select string_agg(case when pos=1 or substr(target,pos,1) in (' ','-',chr(39))
    or (used_level=2 and ((length(target)=3 and pos=2) or (pos%2=1 and pos<length(target)))) then substr(target,pos,1) else '_' end,' ' order by pos)
  into hint_mask from generate_series(1,length(target)) pos;
 end if;
 return jsonb_build_object('allowed',allowed,'used',used_level,'mask',coalesce(hint_mask,''));
end $$;
revoke all on function public.hw_spelling_hint(uuid,uuid,int,int) from public;
grant execute on function public.hw_spelling_hint(uuid,uuid,int,int) to anon,authenticated;

create or replace function public.hw_public_item(i public.homework_items) returns jsonb
language sql stable as $$
 select jsonb_build_object('id',i.id,'kind',i.kind,'title',i.title,
   'config',case when i.config ? 'block' then jsonb_set(i.config,'{block}',((i.config->'block') - 'source' - 'spellingHints') - case when i.config->'block'->>'completion' = 'answers' then 'text' else '__unused' end) else i.config end,
   'content',(i.content - 'questions') || jsonb_build_object('questions',coalesce((
     select jsonb_agg(case when q->'guidedSpelling'='true'::jsonb or q->'missingLetter'='true'::jsonb
       then (q - 'correct' - 'card' - 'speak' - 'contentId') || '{"word":""}'::jsonb
       else q - 'correct' - 'card' end order by ord)
     from jsonb_array_elements(coalesce(i.content->'questions','[]')) with ordinality t(q,ord)),'[]')))
$$;
revoke all on function public.hw_public_item(public.homework_items) from public,anon,authenticated;

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
     case when i.config #> '{block,spellingHints}' is not null then jsonb_build_object(
       'allowed',public.hw_spelling_allowance(i.config,t.student_id),
       'questions',(select coalesce(jsonb_agg(jsonb_build_object(
         'index',q.ord,'prompt',q.value->>'prompt','allowed',
         least(public.hw_spelling_allowance(i.config,t.student_id),case when length(q.value->>'correct')<3 then 1 else 2 end),
         'used',coalesce(h.used,0),'correct',a.correct,
         'word',case when a.q_index is not null then q.value->>'word' end
       ) order by q.ord),'[]'::jsonb)
       from jsonb_array_elements(i.content->'questions') with ordinality q(value,ord)
       left join public.homework_answers a on a.attempt_id=t.id and a.item_id=i.id and a.q_index=q.ord-1
       left join public.homework_spelling_hints h on h.attempt_id=t.id and h.item_id=i.id and h.q_index=q.ord-1
       where q.value->'guidedSpelling'='true'::jsonb)
     ) end spelling_hints,
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
