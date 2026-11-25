begin;
set local lock_timeout = '5s';

-- A retired item keeps its UUID, grading evidence and owning assignment. Existing
-- player/write endpoints select only items whose assignment_id is active.
alter table public.homework_items
  alter column assignment_id drop not null,
  add column retired_from uuid references public.homework_assignments(id) on delete cascade,
  add constraint homework_item_has_one_owner check (num_nonnulls(assignment_id,retired_from)=1);
create index homework_items_retired_from_idx on public.homework_items(retired_from) where retired_from is not null;
alter table public.homework_attempts add column submitted_item_ids uuid[];

create or replace function public.hw_publication(p_assignment uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare h public.homework_assignments; doc jsonb;
begin
  select * into h from public.homework_assignments where id=p_assignment;
  if not found or public.hw_block_academy(h.class_id) is distinct from h.academy_id then raise exception 'not_found'; end if;
  select jsonb_build_object('title',h.title,'due',h.due_at,'closed',h.closed_at,'classId',h.class_id,
    'shortRepeat',h.settings->'shortRepeat',
    'itemIds',coalesce(jsonb_agg(i.id order by i.position),'[]'),
    'items',coalesce(jsonb_agg(jsonb_build_object('kind',i.kind,'title',i.title,'config',i.config,'content',i.content) order by i.position),'[]'),
    'students',coalesce((select jsonb_agg(t.student_id order by t.student_id) from public.homework_assignment_targets t
      where t.assignment_id=h.id),'[]')) into doc from public.homework_items i where i.assignment_id=h.id;
  return doc||jsonb_build_object('version',md5(doc::text),'started',exists(select from public.homework_attempts where assignment_id=h.id));
end $$;

create function public.hw_edit_activities(p_assignment uuid,p_version text,p_title text,p_due timestamptz,
  p_items jsonb,p_item_ids uuid[]) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare h public.homework_assignments; doc jsonb; old_ids uuid[]; retained uuid[]:='{}';
  slot int; previous int; entry jsonb;
begin
  select * into h from public.homework_assignments where id=p_assignment and academy_id=public.hw_staff_academy() for update;
  if not found then raise exception 'not_found'; end if;
  doc:=public.hw_publication(h.id);
  if nullif(btrim(p_title),'') is null then raise exception 'missing_title'; end if;
  if doc->>'version' is distinct from p_version then
    if p_items=doc->'items' and p_title=h.title and p_due is not distinct from h.due_at
       and not exists(select from unnest(p_item_ids) with ordinality as r(id,n)
         where (doc->'itemIds') ? id::text and doc->'itemIds'->>(n::int-1)<>id::text) then return; end if;
    raise exception 'publication_changed';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or cardinality(p_item_ids) is distinct from jsonb_array_length(p_items)
     or array_ndims(p_item_ids)>1 then raise exception 'bad_items'; end if;
  old_ids:=array(select jsonb_array_elements_text(doc->'itemIds')::uuid);
  if exists(select from unnest(p_item_ids) id where id is not null group by id
       having count(*)>1 or not (id=any(old_ids))) then raise exception 'bad_items'; end if;

  if p_items is distinct from doc->'items' or p_item_ids is distinct from old_ids then
    perform public.hw_validate_items(p_items);
    if h.settings ? 'shortRepeat' and not exists(select from jsonb_array_elements(p_items) i where
      i#>>'{config,block,type}'='recall' and jsonb_array_length(i#>'{content,questions}')>0) then raise exception 'no_graded_questions'; end if;
    -- Student writes and final submissions also serialize on their attempt row.
    perform 1 from public.homework_attempts where assignment_id=h.id order by id for update;
    update public.homework_attempts set submitted_item_ids=old_ids where assignment_id=h.id
      and finished_at is not null and submitted_item_ids is null;
    update public.homework_items set position=-position-1 where assignment_id=h.id;
    for slot in 1..cardinality(p_item_ids) loop
      entry:=p_items->(slot-1);
      previous:=array_position(old_ids,p_item_ids[slot]);
      if previous is not null and entry=doc->'items'->(previous-1) then
        retained:=array_append(retained,p_item_ids[slot]);
        update public.homework_items set position=slot-1 where id=p_item_ids[slot];
      else
        insert into public.homework_items(assignment_id,position,kind,title,config,content)
          values(h.id,slot-1,entry->>'kind',coalesce(entry->>'title',''),entry->'config',entry->'content');
      end if;
    end loop;
    update public.homework_items set retired_from=h.id,assignment_id=null,position=-position-1
      where assignment_id=h.id and id=any(old_ids) and not(id=any(retained));
  end if;
  if p_due is distinct from h.due_at then
    update public.homework_assignment_targets set token_expires_at=coalesce(p_due,now()+interval '30 days')+interval '7 days'
      where assignment_id=h.id;
  end if;
  update public.homework_assignments set title=p_title,due_at=p_due where id=h.id;
end $$;
revoke all on function public.hw_edit_activities(uuid,text,text,timestamptz,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.hw_edit_activities(uuid,text,text,timestamptz,jsonb,uuid[]) to authenticated;

-- The teacher RPC may move immutable snapshots. It never updates their payload.
create or replace function public.hw_frozen_item_guard() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if current_user=pg_get_userbyid((select proowner from pg_proc where
     oid='public.hw_edit_activities(uuid,text,text,timestamptz,jsonb,uuid[])'::regprocedure))
     and (new.id,new.kind,new.title,new.config,new.content,new.created_at) is not distinct from
         (old.id,old.kind,old.title,old.config,old.content,old.created_at)
     and old.retired_from is null and (new.assignment_id=old.assignment_id and new.retired_from is null
       or new.assignment_id is null and new.retired_from=old.assignment_id) then return new; end if;
  if old.retired_from is not null or new.retired_from is not null or old.config ? 'block'
    or exists(select from public.homework_assignments where id=old.assignment_id and block_request is not null)
    then raise exception 'assignment_version_frozen'; end if;
  return new;
end $$;

-- A completed attempt keeps the activity order from the time of submission.
create function public.hw_attempt_layout(t public.homework_attempts) returns uuid[]
language sql stable set search_path=pg_catalog,public as $$
  select case when t.finished_at is not null and t.submitted_item_ids is not null then
    array(select i.id from unnest(t.submitted_item_ids) with ordinality slot(id,n)
      join public.homework_items i using(id)
      where i.assignment_id=t.assignment_id or i.retired_from=t.assignment_id order by slot.n)
  else array(select i.id from public.homework_items i where i.assignment_id=t.assignment_id order by i.position) end
$$;
revoke all on function public.hw_attempt_layout(public.homework_attempts) from public,anon,authenticated;


create or replace function public.hw_state_before_short_rounds(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_t public.homework_attempts;
  v_a public.homework_assignments;
  layout uuid[];
begin
  v_t := public.hw_attempt_for(p_token, true);
  select * into v_a from public.homework_assignments where id = v_t.assignment_id;
  update public.homework_attempts set last_seen_at = now() where id = v_t.id;
  layout := public.hw_attempt_layout(v_t);
  return jsonb_build_object(
    'title', v_a.title,
    'name', (select name from public.students where id = v_t.student_id),
    'due_at', v_a.due_at,
    'finished', v_t.finished_at is not null,
    'items', coalesce((select jsonb_agg(public.hw_public_item(i) order by x.n) from unnest(layout) with ordinality x(id,n) join public.homework_items i using(id)), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', h.item_id, 'q_index', h.q_index, 'correct', h.correct, 'response', h.response,
        'answer', public.hw_answer_text(i.content->'questions'->h.q_index)
      ) order by array_position(layout,i.id), h.q_index)
      from public.homework_answers h join public.homework_items i on i.id = h.item_id
      where h.attempt_id = v_t.id and h.item_id=any(layout)
    ), '[]'::jsonb),
    'item_attempts', coalesce((
      select jsonb_agg(jsonb_build_object('item_id', x.item_id, 'finished', x.finished_at is not null, 'score', x.score, 'total', x.total, 'meta', x.meta))
      from public.homework_item_attempts x where x.attempt_id = v_t.id and x.item_id=any(layout)
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.hw_finish_before_blocks(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_t public.homework_attempts;
  v_score int;
  v_total int;
begin
  v_t := public.hw_attempt_for(p_token, true);
  if v_t.finished_at is not null then return jsonb_build_object('score',v_t.score,'total',v_t.total); end if;
  if exists (
    select 1 from public.homework_items i
     where i.assignment_id = v_t.assignment_id
       and not exists (select 1 from public.homework_item_attempts x where x.attempt_id = v_t.id and x.item_id = i.id and x.finished_at is not null)
  ) then
    raise exception 'incomplete';
  end if;
  select coalesce(sum(jsonb_array_length(coalesce(content->'questions', '[]'::jsonb))), 0) into v_total from public.homework_items where assignment_id = v_t.assignment_id;
  select count(*) into v_score from public.homework_answers h join public.homework_items i on i.id=h.item_id where h.attempt_id=v_t.id and h.correct and i.assignment_id=v_t.assignment_id;
  if v_t.finished_at is null then
    update public.homework_attempts set finished_at = now(), score = v_score, total = v_total, last_seen_at = now() where id = v_t.id;
    insert into public.learning_events (academy_id, student_id, assignment_id, attempt_id, event_type, meta)
    select a.academy_id, v_t.student_id, v_t.assignment_id, v_t.id, 'assignment_complete', jsonb_build_object('score', v_score, 'total', v_total)
      from public.homework_assignments a where a.id = v_t.assignment_id;
  end if;
  return jsonb_build_object('score', v_score, 'total', v_total);
end $$;

create or replace function public.hw_assignment_summary(p_assignment_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_a public.homework_assignments;
begin
  select * into v_a from public.homework_assignments where id = p_assignment_id and academy_id = v_academy;
  if v_a.id is null then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'target_count', coalesce(v_a.target_count, 0),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'title', i.title, 'count', jsonb_array_length(coalesce(i.content->'questions', '[]'::jsonb))) order by i.position) from public.homework_items i where i.assignment_id = v_a.id), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', s.id, 'name', s.name, 'archived', s.archived_at is not null,
        'status', case when t.id is null then 'none' when t.finished_at is not null then 'done' else 'doing' end,
        'submitted_total',case when t.finished_at is not null then t.total end,
        'answered', (select count(*) from public.homework_answers h where h.attempt_id = t.id and h.item_id=any(public.hw_attempt_layout(t))),
        'correct', (select count(*) from public.homework_answers h where h.attempt_id = t.id and h.item_id=any(public.hw_attempt_layout(t)) and h.correct),
        'minutes', case when t.id is null then null else greatest(1, round(extract(epoch from (coalesce(t.finished_at, t.last_seen_at) - t.started_at)) / 60)) end,
        'retries', (select coalesce(sum(x.retry_count), 0) from public.homework_item_attempts x where x.attempt_id = t.id and x.item_id=any(public.hw_attempt_layout(t))),
        'rewarded', t.rewarded_at is not null,
        'wrong_words', coalesce((select jsonb_agg(distinct h.word) from public.homework_answers h where h.attempt_id = t.id and h.item_id=any(public.hw_attempt_layout(t)) and not h.correct and h.word <> ''), '[]'::jsonb)
      ) order by s.name)
      from public.homework_assignment_targets g
      join public.students s on s.id = g.student_id
      left join public.homework_attempts t on t.assignment_id = v_a.id and t.student_id = s.id
      where g.assignment_id = v_a.id
    ), '[]'::jsonb),
    'class_wrong_words', coalesce((
      select jsonb_agg(jsonb_build_object('word', w.word, 'count', w.n, 'card', w.card) order by w.n desc)
        from (
          select h.word, count(*) as n,
                 (select e.meta from public.learning_events e where e.assignment_id = v_a.id and e.word = h.word and e.meta ? 'meaning' order by e.id desc limit 1) as card
            from public.homework_answers h join public.homework_attempts t on t.id = h.attempt_id
           where t.assignment_id = v_a.id and h.item_id=any(public.hw_attempt_layout(t)) and not h.correct and h.word <> ''
           group by h.word order by count(*) desc limit 15
        ) w
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.hw_block_results(p_assignment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := public.hw_staff_academy(); c uuid;
begin
 select class_id into c from public.homework_assignments where id=p_assignment and academy_id=a;
 if c is null then raise exception 'not_found'; end if;
 perform public.hw_block_academy(c);
 return coalesce((select jsonb_agg(row_to_json(x) order by (x.meta->>'review'='pending') desc nulls last,x.name,x.position) from (
   select t.id attempt_id,i.id item_id,t.student_id,s.name,i.title,layout.n-1 as position,coalesce(ia.meta,'{}') meta,ia.finished_at is not null finished,ia.id is not null started,
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
   from public.homework_attempts t join public.students s on s.id=t.student_id cross join lateral unnest(public.hw_attempt_layout(t)) with ordinality layout(id,n) join public.homework_items i on i.id=layout.id
   left join public.homework_item_attempts ia on ia.attempt_id=t.id and ia.item_id=i.id
   where t.assignment_id=p_assignment and i.config ? 'block'
 ) x),'[]');
end $$;

create or replace function public.hw_review_block(p_attempt uuid,p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid := public.hw_staff_academy(); c uuid;
begin
 select h.class_id into c from public.homework_attempts t join public.homework_assignments h on h.id=t.assignment_id join public.homework_items i on i.id=any(public.hw_attempt_layout(t)) where t.id=p_attempt and i.id=p_item and h.academy_id=a;
 if c is null then raise exception 'not_found'; end if;
 perform public.hw_block_academy(c);
 update public.homework_item_attempts set meta=meta || jsonb_build_object('review','reviewed','reviewedAt',now(),'reviewedBy',auth.uid()) where attempt_id=p_attempt and item_id=p_item and finished_at is not null and meta->>'review'='pending';
end $$;

create or replace function public.hw_watch_summary(p_assignment_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if not exists (select 1 from public.homework_assignments where id = p_assignment_id and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'student_id', s.id, 'name', s.name, 'item_id', i.id,
      'target', greatest(1, least(coalesce((i.config->>'targetViews')::int, 1), 10)),
      'views', (select count(*) from public.homework_watch_views w where w.attempt_id = t.id and w.item_id = i.id and w.completed_at is not null),
      'last_at', (select max(w.completed_at) from public.homework_watch_views w where w.attempt_id = t.id and w.item_id = i.id),
      'partial_pct', (select round(100.0 * max(w.watched_sec) / nullif(max(w.duration_sec), 0)) from public.homework_watch_views w where w.attempt_id = t.id and w.item_id = i.id and w.completed_at is null)
    ) order by s.name, coalesce(array_position(t.submitted_item_ids,i.id),i.position+1))
    from public.homework_assignment_targets g
    join public.students s on s.id = g.student_id
    left join public.homework_attempts t on t.assignment_id = p_assignment_id and t.student_id = s.id
    join public.homework_items i on coalesce(i.config->>'watch', '') = 'true' and
      (case when t.submitted_item_ids is null then i.assignment_id=p_assignment_id
        else i.id=any(public.hw_attempt_layout(t)) end)
    where g.assignment_id = p_assignment_id
  ), '[]'::jsonb);
end $fn$;

notify pgrst,'reload schema';
commit;
