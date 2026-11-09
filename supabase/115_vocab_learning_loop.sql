-- Teacher-approved vocabulary plans, explicit follow-up links and solo practice games.
begin;

-- Do not replace path engine changes applied independently of this migration.
do $check$
begin
  if not exists (
    select 1 from pg_proc where oid=to_regprocedure('public.learning_path_payload(uuid)')
    and md5(replace(prosrc,chr(13)||chr(10),chr(10))) in ('146648d1695e4d87d0182c198d9ed168','96badaf7d262a57916c16071b64e6fd4')
  ) or not exists (
    select 1 from pg_proc where oid=to_regprocedure('public.learning_path_action(uuid,uuid,uuid,integer,text,text)')
    and md5(replace(prosrc,chr(13)||chr(10),chr(10))) in ('cf9e37de8e424e69fdc867ad2bd0264d','e7870fd4aa970be0e7bf941de09cc07e')
  ) then raise exception 'vocab_path_engine_changed'; end if;
end $check$;

create table if not exists public.learning_vocab_drafts (
  id uuid primary key default gen_random_uuid(),
  source_lesson uuid not null references public.learning_path_plans(lesson_id) on delete cascade,
  kind text not null check (kind in ('lesson','homework')),
  student_id uuid,
  proposal jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  dismissed_at timestamptz
);
create index if not exists learning_vocab_draft_source on public.learning_vocab_drafts(source_lesson);
create table if not exists public.learning_vocab_approvals (
  academy_id uuid not null references public.academies(id) on delete cascade,
  request_id uuid not null,
  lesson_id uuid not null unique references public.learning_path_plans(lesson_id) on delete cascade,
  draft_id uuid unique references public.learning_vocab_drafts(id) on delete set null,
  approval_payload jsonb not null,
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  primary key (academy_id,request_id)
);
alter table public.learning_vocab_drafts enable row level security;
alter table public.learning_vocab_approvals enable row level security;
revoke all on public.learning_vocab_drafts,public.learning_vocab_approvals from public,anon,authenticated;

-- Look up only verified first responses for the exact delivered item and goal.
create or replace function public.learning_vocab_first(p_assignment uuid,p_position int,p_goal uuid)
returns table(correct boolean,answered_at timestamptz) language sql stable set search_path=public as $$
  select e.correct,e.created_at from public.learning_evidence_links link
  join public.solo_step_events e on e.id=link.evidence_id
  join public.learning_delivery_runs r on r.id=link.run_id and r.source='solo' and r.resource_id=e.assignment_id
  join public.learning_solo_versions v on v.assignment_id=e.assignment_id and v.snapshot_id=r.snapshot_id
  where e.assignment_id=p_assignment and e.step_index=p_position and link.position=p_position and link.goal_id=p_goal
    and link.source_table='solo_step_events' and link.version_matches
  order by e.id limit 1
$$;
create index if not exists learning_vocab_requests_assignment on public.learning_path_requests(assignment_id);

-- A row is one active student and one planned word/meaning. The check and the
-- first homework answer are separate, even when the learner later retries.
create or replace function public.learning_vocab_rows(p_lesson uuid)
returns table(student_id uuid,student_name text,goal_index int,card jsonb,first_correct boolean,
  first_check_correct boolean,independent_correct boolean,practice_hint_used boolean,
  review_correct boolean,review_round int,homework_id uuid,homework_correct boolean,
  homework_review_correct boolean,homework_review_round int,latest_correct boolean)
language sql stable set search_path=public as $$
  select a.student_id,st.name,n.idx,c.card,diagnostic.correct,first_check.correct,
    initial.correct,exists(select 1 from public.learning_path_requests req where req.assignment_id=a.id
      and req.result->'state'->>'position'=(n.idx*4+3)::text
      and req.result->'state'->>'hint' is not null),
    review.correct,review.round,hw.assignment_id,hw_first.correct,hw.review_correct,hw.review_round,latest.correct
  from public.learning_path_plans p
  join public.solo_assignments a on a.lesson_id=p.lesson_id and a.academy_id=p.academy_id
  join public.students st on st.id=a.student_id and st.class_id=p.class_id and st.academy_id=p.academy_id and st.archived_at is null
  cross join lateral jsonb_array_elements(p.cards) with ordinality c(card,ordinality)
  cross join lateral (select c.ordinality::int-1 as idx) n
  left join public.learning_goals g on g.word=c.card->>'word' and g.meaning=regexp_replace(c.card->>'meaning','\s+',' ','g')
  left join public.learning_path_states s on s.assignment_id=a.id
  left join lateral public.learning_vocab_first(a.id,n.idx*4+1,g.id) diagnostic on true
  left join lateral public.learning_vocab_first(a.id,n.idx*4+4,g.id) first_check on true
  left join public.learning_delivery_items item on item.run_id=s.run_id and item.position=n.idx*4+4
    and item.question=-1 and item.goal_id=g.id
  left join public.learning_path_checks initial on item.run_id is not null and initial.assignment_id=a.id
    and initial.goal_index=n.idx and initial.round=0
  left join lateral (
    select ch.correct,ch.round,ch.checked_at from public.learning_path_checks ch
    where item.run_id is not null and ch.assignment_id=a.id and ch.goal_index=n.idx and ch.round>0
    order by ch.round desc limit 1
  ) review on true
  left join lateral (
    select ha.id as assignment_id,hn.idx,hr.correct as review_correct,hr.round as review_round,hr.checked_at
    from public.learning_vocab_drafts d
    join public.learning_vocab_approvals v on v.draft_id=d.id and v.academy_id=p.academy_id
    join public.learning_path_plans hp on hp.lesson_id=v.lesson_id and hp.class_id=p.class_id
    join public.solo_assignments ha on ha.lesson_id=hp.lesson_id and ha.student_id=a.student_id and ha.kind='homework'
    cross join lateral jsonb_array_elements(hp.cards) with ordinality hc(card,ordinality)
    cross join lateral (select hc.ordinality::int-1 as idx) hn
    left join public.learning_path_states hs on hs.assignment_id=ha.id
    left join public.learning_delivery_items hi on hi.run_id=hs.run_id and hi.position=hn.idx*4+4
      and hi.question=-1 and hi.goal_id=g.id
    left join lateral (
      select ch.correct,ch.round,ch.checked_at from public.learning_path_checks ch
      where hi.run_id is not null and ch.assignment_id=ha.id and ch.goal_index=hn.idx and ch.round>0
      order by ch.round desc limit 1
    ) hr on true
    where d.source_lesson=p.lesson_id and d.kind='homework'
      and hc.card->>'word'=c.card->>'word' and hc.card->>'meaning'=c.card->>'meaning'
    order by v.approved_at desc,v.request_id limit 1
  ) hw on true
  left join lateral public.learning_vocab_first(hw.assignment_id,hw.idx*4+1,g.id) hw_first on true
  left join lateral (
    select evidence.correct from (values (initial.correct,initial.checked_at),(review.correct,review.checked_at),
      (hw_first.correct,hw_first.answered_at),(hw.review_correct,hw.checked_at)) evidence(correct,answered_at)
    where evidence.answered_at is not null order by evidence.answered_at desc limit 1
  ) latest on true
  where p.lesson_id=p_lesson and a.kind='lesson'
$$;

create or replace function public.learning_vocab_feedback(p_class uuid,p_lesson uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy();
begin
  if not public.academy_feature(ac,'solo') then raise exception 'feature_closed'; end if;
  if not exists(select 1 from public.classes where id=p_class and academy_id=ac) then raise exception 'bad_class'; end if;
  if p_lesson is not null and not exists(
    select 1 from public.learning_path_plans p where p.lesson_id=p_lesson and p.class_id=p_class and p.academy_id=ac
    and not exists(select 1 from public.learning_homework_plans h where h.lesson_id=p.lesson_id)
  ) then raise exception 'not_found'; end if;
  return jsonb_build_object(
    'lessons',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc,l.id) from (
      select p.lesson_id as id,s.name,p.created_at from public.learning_path_plans p
      join public.solo_lessons s on s.id=p.lesson_id
      where p.class_id=p_class and p.academy_id=ac
        and not exists(select 1 from public.learning_homework_plans h where h.lesson_id=p.lesson_id)
      order by p.created_at desc,p.lesson_id limit 30
    ) l),'[]'::jsonb),
    'homework_enabled',public.academy_feature(ac,'homework'),
    'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.goal_index,r.student_name,r.student_id)
      from public.learning_vocab_rows(p_lesson) r),'[]'::jsonb),
    'drafts',coalesce((select jsonb_agg(d.proposal||jsonb_build_object('id',d.id,'kind',d.kind) order by d.created_at desc)
      from public.learning_vocab_drafts d where d.source_lesson=p_lesson and d.created_by=auth.uid()
        and d.dismissed_at is null and not exists(select 1 from public.learning_vocab_approvals v where v.draft_id=d.id)
    ),'[]'::jsonb),
    'followups',coalesce((select jsonb_agg(jsonb_build_object('id',v.lesson_id,'name',l.name,'kind',d.kind) order by v.approved_at desc)
      from public.learning_vocab_drafts d join public.learning_vocab_approvals v on v.draft_id=d.id and v.academy_id=ac
      join public.solo_lessons l on l.id=v.lesson_id where d.source_lesson=p_lesson
    ),'[]'::jsonb)
  );
end$$;

create or replace function public.learning_vocab_draft(p_source uuid,p_kind text,p_student uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy(); source_name text; proposal jsonb; draft uuid;
begin
  if p_kind is null or p_kind not in ('lesson','homework') then raise exception 'bad_kind'; end if;
  if not public.academy_feature(ac,'solo') or (p_kind='homework' and not public.academy_feature(ac,'homework'))
    then raise exception 'feature_closed'; end if;
  select l.name into source_name from public.learning_path_plans p join public.solo_lessons l on l.id=p.lesson_id
  where p.lesson_id=p_source and p.academy_id=ac
    and not exists(select 1 from public.learning_homework_plans h where h.lesson_id=p.lesson_id);
  if source_name is null then raise exception 'not_found'; end if;
  with observed as (
    select *
    from public.learning_vocab_rows(p_source)
    where (p_student is null or student_id=p_student) and independent_correct is not null
      and (homework_id is null or homework_correct is not null)
  ), eligible as (
    select * from observed where latest_correct=false or (p_kind='homework' and homework_id is null)
  ), ranked as (
    select goal_index,card,count(*) filter(where latest_correct=false) as needs_practice
    from eligible group by goal_index,card
    order by needs_practice desc,goal_index
    limit case when p_student is null then 1 when p_kind='homework' then 8 else 12 end
  )
  select jsonb_build_object(
    'title',left(source_name,85)||case when p_kind='homework' then ' · 어휘 후속 숙제' else ' · 어휘 보충 수업' end,
    'cards',coalesce((select jsonb_agg(card order by needs_practice desc,goal_index) from ranked),'[]'::jsonb),
    'students',coalesce((select jsonb_agg(distinct e.student_id) from eligible e join ranked r using(goal_index)),'[]'::jsonb),
    'reason',case when exists(select 1 from ranked where needs_practice>0) then 'practice' else 'check' end,
    'games',exists(select 1 from ranked where needs_practice>0)
  ) into proposal;
  if jsonb_array_length(proposal->'cards')=0 then return null; end if;
  insert into public.learning_vocab_drafts(source_lesson,kind,student_id,proposal,created_by)
    values(p_source,p_kind,p_student,proposal,auth.uid()) returning id into draft;
  return proposal||jsonb_build_object('id',draft,'kind',p_kind);
end$$;

create or replace function public.learning_vocab_dismiss(p_draft uuid)
returns void language plpgsql security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy();
begin
  perform 1 from public.learning_vocab_drafts d join public.learning_path_plans p on p.lesson_id=d.source_lesson
    where d.id=p_draft and p.academy_id=ac for update of d;
  if not found then raise exception 'not_found'; end if;
  if exists(select 1 from public.learning_vocab_approvals where draft_id=p_draft) then raise exception 'already_approved'; end if;
  update public.learning_vocab_drafts set dismissed_at=coalesce(dismissed_at,now()) where id=p_draft;
end$$;

-- Decorate the existing four-position path with the game rules before any
-- student can open it. The two games use the frozen learn and practice items.
create or replace function public.learning_vocab_game_steps(p_steps jsonb)
returns jsonb language sql immutable set search_path=public as $$
  select jsonb_agg(case s.step->>'path_phase'
    when 'learn' then s.step||jsonb_build_object('vocab_game','meaning-balloon-v1','game_choices',(
      select jsonb_agg(word order by md5(word||s.idx::text),word) from (
        select word from (
          select s.step->>'word' as word,0 as priority
          union all select x->>'word',1 from jsonb_array_elements(p_steps) x
            where x->>'path_phase'='learn' and x->>'word'<>s.step->>'word'
          union all select fallback,2 from unnest(array['apple','river','book']) fallback
        ) candidates group by word order by min(priority),word limit 3
      ) choices
    ))
    when 'practice' then s.step||jsonb_build_object('vocab_game','spelling-train-v1')
    else s.step end order by s.idx)
  from jsonb_array_elements(p_steps) with ordinality s(step,idx)
$$;

create or replace function public.learning_vocab_approve(
  p_request uuid,p_class uuid,p_students uuid[],p_title text,p_cards jsonb,p_practice text,
  p_games boolean,p_draft uuid default null,p_due timestamptz default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy(); proposal public.learning_vocab_drafts;
  previous public.learning_vocab_approvals; payload jsonb; result jsonb; target uuid;
begin
  if p_request is null or p_games is null or p_practice is null or p_practice not in ('letters','recall')
    or (p_games and p_practice<>'letters') or (p_draft is not null and p_draft<>p_request)
    then raise exception 'bad_plan'; end if;
  payload:=jsonb_build_array(p_class,(select jsonb_agg(distinct s order by s) from unnest(p_students) s),
    btrim(p_title),p_cards,p_practice,p_games,p_draft,p_due);
  perform pg_advisory_xact_lock(hashtext(ac::text||p_request::text));
  select * into previous from public.learning_vocab_approvals where academy_id=ac and request_id=p_request;
  if found then
    if previous.approval_payload<>payload then raise exception 'request_changed'; end if;
    return jsonb_build_object('lesson_id',previous.lesson_id,'duplicate',true);
  end if;
  if p_draft is not null then
    select d.* into proposal from public.learning_vocab_drafts d
    join public.learning_path_plans p on p.lesson_id=d.source_lesson
    where d.id=p_draft and p.academy_id=ac and p.class_id=p_class for update of d;
    if not found or proposal.dismissed_at is not null then raise exception 'draft_not_available'; end if;
  end if;
  if exists(select 1 from public.learning_path_plans where academy_id=ac and request_id=p_request)
    then raise exception 'request_changed'; end if;
  if proposal.kind='homework' then
    if jsonb_typeof(p_cards) is distinct from 'array' then raise exception 'bad_cards'; end if;
    if not exists (
      select 1 from public.learning_path_plans p cross join lateral jsonb_array_elements(p.cards) original
      cross join lateral jsonb_array_elements(p_cards) edited
      where p.lesson_id=proposal.source_lesson and original->>'word'=lower(btrim(edited->>'word'))
        and original->>'meaning'=btrim(edited->>'meaning')
    ) then raise exception 'bad_link_goal'; end if;
    if exists (
      select 1 from unnest(p_students) sid where not exists(
        select 1 from public.solo_assignments a where a.lesson_id=proposal.source_lesson and a.student_id=sid and a.kind='lesson'
      )
    ) then raise exception 'bad_link_student'; end if;
    result:=public.learning_homework_assign(p_request,p_class,p_students,p_title,p_cards,p_practice,8,p_due,'manual',null);
  else
    if p_due is not null then raise exception 'bad_due'; end if;
    result:=public.learning_path_assign(p_request,p_class,p_students,p_title,p_cards,p_practice);
  end if;
  if (result->>'duplicate')::boolean then raise exception 'request_changed'; end if;
  target:=(result->>'lesson_id')::uuid;
  if p_games then
    update public.solo_lessons set steps=public.learning_vocab_game_steps(steps) where id=target;
  end if;
  insert into public.learning_vocab_approvals(academy_id,request_id,lesson_id,draft_id,approval_payload,approved_by)
    values(ac,p_request,target,p_draft,payload,auth.uid());
  return result;
end$$;

revoke all on function public.learning_vocab_first(uuid,int,uuid),public.learning_vocab_rows(uuid),
  public.learning_vocab_game_steps(jsonb),public.learning_vocab_feedback(uuid,uuid),
  public.learning_vocab_draft(uuid,text,uuid),public.learning_vocab_dismiss(uuid),
  public.learning_vocab_approve(uuid,uuid,uuid[],text,jsonb,text,boolean,uuid,timestamptz)
  from public,anon,authenticated;
grant execute on function public.learning_vocab_feedback(uuid,uuid),public.learning_vocab_draft(uuid,text,uuid),
  public.learning_vocab_dismiss(uuid),public.learning_vocab_approve(uuid,uuid,uuid[],text,jsonb,text,boolean,uuid,timestamptz)
  to authenticated;


-- Existing path engine with the two versioned practice presentations.
create or replace function public.learning_path_payload(p_assignment uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare state public.learning_path_states; d jsonb; q jsonb; phase text; words int;
begin
  select * into state from public.learning_path_states where assignment_id=p_assignment;
  select s.definition->'grading'->'steps' into d from public.learning_delivery_runs r join public.learning_sensor_snapshots s on s.id=r.snapshot_id where r.id=state.run_id;
  words:=(jsonb_array_length(d)-1)/4;
  q:=d->state.position;
  phase:=case when state.round>0 then 'delayed_check' else q->>'path_phase' end;
  return jsonb_build_object('run_id',state.run_id,'position',state.position,'goal_index',state.goal_index,'words',words,'round',state.round,
    'phase',phase,'waiting',coalesce(state.due_at>now(),false),'due_at',state.due_at,'finished',state.finished_at is not null,
    'step',case when state.finished_at is null and (state.due_at is null or state.due_at<=now()) then (public.solo_public_step(q)-'first') || jsonb_strip_nulls(jsonb_build_object('vocab_game',q->'vocab_game','game_choices',q->'game_choices')) end,
    'hint',case when state.helped then left(q->>'word',1) end);
end$$;

create or replace function public.learning_path_action(p_token uuid,p_assignment uuid,p_request uuid,p_position int,p_action text,p_value text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.solo_assignments; state public.learning_path_states; prev public.learning_path_requests; d jsonb; q jsonb; phase text; result jsonb; feedback jsonb; hash text; ok boolean; words int; g int; pos int; next_round int; old_context text;
begin
  a:=public.solo_assignment_for(p_token,p_assignment);
  -- Same lock order as learning_path_open: assignment first, then state (avoids deadlock).
  perform 1 from public.solo_assignments where id=a.id for update;
  select * into state from public.learning_path_states where assignment_id=a.id for update;
  if state.assignment_id is null or p_request is null then raise exception 'not_found'; end if;
  hash:=md5(jsonb_build_array(p_position,p_action,p_value)::text);
  select * into prev from public.learning_path_requests where id=p_request;
  if prev.id is not null then
    if prev.assignment_id<>a.id or prev.request_hash<>hash then raise exception 'bad_request'; end if;
    return prev.result;
  end if;
  if p_position is distinct from state.position or state.finished_at is not null then raise exception 'path_changed'; end if;
  if state.due_at>now() then raise exception 'not_due'; end if;
  select s.definition->'grading'->'steps' into d from public.learning_delivery_runs r join public.learning_sensor_snapshots s on s.id=r.snapshot_id where r.id=state.run_id;
  q:=d->state.position; words:=(jsonb_array_length(d)-1)/4;
  phase:=case when state.round>0 then 'delayed_check' else q->>'path_phase' end;
  if p_action='hint' then
    if phase<>'practice' then raise exception 'hint_not_available'; end if;
    update public.learning_path_states set helped=true where assignment_id=a.id;
    result:=jsonb_build_object('state',public.learning_path_payload(a.id));
  elsif phase='learn' and p_action='continue' and q->>'vocab_game'='meaning-balloon-v1'
      and p_value is distinct from q->>'word' then
    if p_value is null or not (q->'game_choices' ? p_value) then raise exception 'bad_game_choice'; end if;
    result:=jsonb_build_object('state',public.learning_path_payload(a.id),'game_correct',false,'game_choice',p_value);
  elsif phase='learn' and p_action='continue' then
    update public.learning_path_states set position=position+1,helped=false,updated_at=now() where assignment_id=a.id;
    result:=jsonb_build_object('state',public.learning_path_payload(a.id));
    if q->>'vocab_game'='meaning-balloon-v1' then
      result:=result||jsonb_build_object('game_correct',true,'game_choice',p_value);
    end if;
  elsif phase in ('diagnostic','practice','check','delayed_check') and p_action in ('answer','unknown') then
    if p_value is not null and length(p_value)>300 then raise exception 'bad_answer'; end if;
    old_context:=current_setting('app.learning_path_context',true);
    perform set_config('app.learning_path_context',jsonb_build_object('assignment',a.id,'position',state.position)::text,true);
    result:=public.learning_run_action(state.run_id,p_token::text,state.position,'answer',jsonb_build_object('value',case when p_action='unknown' then '' else coalesce(p_value,'') end));
    perform set_config('app.learning_path_context',coalesce(old_context,''),true);
    ok:=coalesce((result->>'correct')::boolean,false);
    feedback:=jsonb_build_object('phase',phase,'correct',ok,'answer',case when phase<>'diagnostic' then public.solo_correct_text(q) end);
    if phase='diagnostic' then
      pos:=state.position+case when ok then 3 else 1 end;
      update public.learning_path_states set position=pos,helped=false,updated_at=now() where assignment_id=a.id;
    elsif phase='practice' then
      update public.learning_path_states set position=position+1,helped=false,updated_at=now() where assignment_id=a.id;
    elsif phase='check' and not ok and not state.revisited then
      update public.learning_path_states set position=1+state.goal_index*4+1,revisited=true,helped=false,updated_at=now() where assignment_id=a.id;
    else
      insert into public.learning_path_checks(assignment_id,goal_index,round,correct,helped) values(a.id,state.goal_index,state.round,ok,state.helped);
      g:=state.goal_index+1; next_round:=state.round;
      if g<words then
        pos:=g*4+case when state.round=0 then 1 else 4 end;
        update public.learning_path_states set goal_index=g,position=pos,revisited=false,helped=false,updated_at=now() where assignment_id=a.id;
      elsif state.round<2 then
        next_round:=state.round+1;
        update public.learning_path_states set goal_index=0,position=4,round=next_round,revisited=false,helped=false,
          first_completed_at=coalesce(first_completed_at,now()),due_at=case when next_round=1 then now()+interval '1 day' else greatest(coalesce(first_completed_at,now())+interval '7 days',now()+interval '1 day') end,updated_at=now() where assignment_id=a.id;
      else
        update public.learning_path_states set finished_at=now(),updated_at=now() where assignment_id=a.id;
        update public.solo_assignments set finished_at=coalesce(finished_at,now()),progress=jsonb_array_length(d) where id=a.id;
      end if;
    end if;
    result:=jsonb_build_object('state',public.learning_path_payload(a.id),'feedback',feedback);
  else raise exception 'bad_path_action'; end if;
  insert into public.learning_path_requests(id,assignment_id,request_hash,result) values(p_request,a.id,hash,result);
  return result;
end$$;

commit;
