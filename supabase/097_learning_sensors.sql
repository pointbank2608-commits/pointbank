-- Learning sensors v1. Additive; no grading, scheduling, assignment or recommendation changes.
-- Prerequisites: 041, 047/060, 074, 090. 088 is optional (detected through row JSON).
begin;
create table if not exists public.learning_sensor_snapshots (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  source text not null,
  resource_id uuid not null,
  fingerprint text not null,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  unique(academy_id, source, resource_id, fingerprint)
);
create table if not exists public.learning_sensor_events (
  id uuid primary key,
  academy_id uuid not null references public.academies(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  class_id uuid,
  source text not null check(source in ('homework','solo','word_memory','group')),
  resource_id uuid not null,
  snapshot_id uuid not null references public.learning_sensor_snapshots(id) on delete cascade,
  session_id uuid not null,
  position int not null check(position >= 0),
  question int check(question >= 0),
  action text not null check(action in ('shown','interval','left','hidden','resumed','submitted','hint','revealed','audio','help_requested','help_resolved')),
  client_at timestamptz not null,
  received_at timestamptz not null default now(),
  visible_ms int not null check(visible_ms between 0 and 30000),
  input_recent_ms int not null check(input_recent_ms between 0 and visible_ms),
  schema_version text not null default 'sensor-v1'
);
create index if not exists learning_sensor_scope_idx on public.learning_sensor_events(academy_id, received_at desc);
create index if not exists learning_sensor_student_idx on public.learning_sensor_events(student_id, source, resource_id, received_at desc);
alter table public.learning_sensor_events enable row level security;
alter table public.learning_sensor_snapshots enable row level security;
revoke all on public.learning_sensor_events, public.learning_sensor_snapshots from public, anon, authenticated;

-- Resolve identity and content on the server. No student IDs, marks, answers, words or arbitrary metadata accepted.
create or replace function public.learning_sensor_report(p_source text, p_credential text, p_resource uuid, p_events jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  hw public.homework_attempts; item public.homework_items;
  sa public.solo_assignments; wt public.wm_targets; ws public.wm_sessions;
  ac uuid; st uuid; cl uuid; snap uuid; definition jsonb; hash text;
  e jsonb; pos int; qi int; maxpos int; at_time timestamptz;
  inserted int := 0; n int;
begin
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 40 then raise exception 'bad_sensor_batch'; end if;
  if p_source='homework' then
    hw := public.hw_attempt_for(p_credential::uuid, true);
    select * into item from public.homework_items where id=p_resource and assignment_id=hw.assignment_id;
    if item.id is null then raise exception 'not_found'; end if;
    select a.academy_id, a.class_id into ac,cl from public.homework_assignments a where a.id=hw.assignment_id;
    st:=hw.student_id; maxpos:=0;
    definition:=jsonb_build_object('assignment_id',hw.assignment_id,'item_id',item.id,'position',item.position,'kind',item.kind,'config',item.config,'content',item.content);
  elsif p_source='solo' then
    sa:=public.solo_assignment_for(p_credential::uuid,p_resource);
    ac:=sa.academy_id; st:=sa.student_id;
    select l.class_id, jsonb_build_object('lesson_id',l.id,'steps',l.steps,'source',l.source) into cl,definition from public.solo_lessons l where l.id=sa.lesson_id;
    maxpos:=jsonb_array_length(definition->'steps')-1;
  elsif p_source='word_memory' then
    wt:=public.wm_target_for(p_credential);
    select * into ws from public.wm_sessions where id=p_resource and target_id=wt.id;
    if ws.id is null then raise exception 'not_found'; end if;
    select p.academy_id,p.class_id into ac,cl from public.wm_plans p where p.id=wt.plan_id;
    st:=wt.student_id;
    -- Ignore mutable hint state for stable content identity; answers remain private in this snapshot.
    definition:=jsonb_build_object('plan_id',wt.plan_id,'day',ws.day,'questions',(
      select coalesce(jsonb_agg(q - 'help' - 'elim' - 'hint' order by ord),'[]') from jsonb_array_elements(ws.questions) with ordinality as x(q,ord)
    ),'rule_version',(select p.rule_version from public.wm_plans p where p.id=wt.plan_id));
    maxpos:=jsonb_array_length(ws.questions)-1;
  elsif p_source='group' then
    if public.is_staff() is distinct from true then raise exception 'forbidden'; end if;
    select l.academy_id,l.class_id,to_jsonb(l)-'created_by'-'name'-'created_at'-'updated_at' into ac,cl,definition
      from public.curriculum_lessons l where l.id=p_resource and l.academy_id=public.my_academy_id();
    if ac is null then raise exception 'not_found'; end if;
    -- This is teacher-side execution only. No per-student attribution.
    maxpos:=9999;
  else raise exception 'bad_sensor_source'; end if;
  if ac is null then raise exception 'not_found'; end if;
  if (select count(*) from public.learning_sensor_events where academy_id=ac and student_id is not distinct from st and received_at>now()-interval '1 minute')>1800 then raise exception 'sensor_rate_limit'; end if;
  hash:=md5(definition::text);
  insert into public.learning_sensor_snapshots(academy_id,source,resource_id,fingerprint,definition)
    values(ac,p_source,p_resource,hash,definition) on conflict do nothing;
  select s.id into snap from public.learning_sensor_snapshots s where s.academy_id=ac and s.source=p_source and s.resource_id=p_resource and s.fingerprint=hash;
  for e in select value from jsonb_array_elements(p_events) loop
    if not (e ?& array['id','session','position','action','at','visible_ms','input_recent_ms'])
      or (e - array['id','session','position','question','action','at','visible_ms','input_recent_ms']) <> '{}'::jsonb then raise exception 'bad_sensor_fields'; end if;
    pos:=(e->>'position')::int; qi:=(e->>'question')::int; at_time:=(e->>'at')::timestamptz;
    if pos is null or pos not between 0 and maxpos or (qi is not null and qi<0) then raise exception 'bad_sensor_position'; end if;
    if p_source='homework' and qi is not null and qi>=jsonb_array_length(coalesce(item.content->'questions','[]')) then raise exception 'bad_sensor_question'; end if;
    if at_time is null or at_time>now()+interval '5 minutes' or at_time<now()-interval '7 days' then raise exception 'bad_sensor_time'; end if;
    insert into public.learning_sensor_events(id,academy_id,student_id,class_id,source,resource_id,snapshot_id,session_id,position,question,action,client_at,visible_ms,input_recent_ms)
      values((e->>'id')::uuid,ac,st,cl,p_source,p_resource,snap,(e->>'session')::uuid,pos,qi,e->>'action',at_time,(e->>'visible_ms')::int,(e->>'input_recent_ms')::int)
      on conflict(id) do nothing;
    get diagnostics n=row_count; inserted:=inserted+n;
  end loop;
  return jsonb_build_object('accepted',inserted,'schema_version','sensor-v1');
end $$;
revoke all on function public.learning_sensor_report(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.learning_sensor_report(text,text,uuid,jsonb) to anon,authenticated;

-- Read-only normalization of existing server-graded evidence. No old grades or rows rewritten.
create or replace view public.learning_sensor_outcomes as
select 'learning_events:'||e.id as evidence_id,e.academy_id,e.student_id,
  case when nullif(to_jsonb(e)->>'solo_assignment_id','') is not null then 'solo_game' else 'homework' end as source,
  coalesce(nullif(to_jsonb(e)->>'solo_assignment_id','')::uuid,e.assignment_id) as assignment_id,
  e.item_id as resource_id,e.q_index as position,e.skill,e.word,
  coalesce(e.meta->'card'->>'meaning',e.meta->>'meaning') as meaning,
  e.correct,e.event_type='answer' as first_attempt,null::boolean as helped,
  e.created_at as observed_at, 'server_graded'::text as provenance
from public.learning_events e where e.event_type in ('answer','retry_answer') and e.correct is not null
union all
select 'solo_step_events:'||e.id,a.academy_id,a.student_id,'solo',a.id,a.id,e.step_index,e.skill,null,null,e.correct,
  row_number() over(partition by e.assignment_id,e.step_index order by e.created_at,e.id)=1,
  null::boolean,e.created_at,'server_graded'
from public.solo_step_events e join public.solo_assignments a on a.id=e.assignment_id
where e.kind='answer' and e.correct is not null
union all
select 'wm_answers:'||a.id,p.academy_id,t.student_id,'word_memory',p.id,s.id,a.q_index,a.skill,
  (select c->>'word' from jsonb_array_elements(p.cards) c where c->>'key'=a.key limit 1),
  (select c->>'meaning' from jsonb_array_elements(p.cards) c where c->>'key'=a.key limit 1),
  a.correct,a.kind='answer',a.helped,a.created_at,'server_graded'
from public.wm_answers a join public.wm_sessions s on s.id=a.session_id
join public.wm_targets t on t.id=s.target_id join public.wm_plans p on p.id=t.plan_id
where a.kind in ('answer','retry') and a.correct is not null;
revoke all on public.learning_sensor_outcomes from public,anon,authenticated;

-- Platform admin only. Descriptive coverage, NOT causal effects, retention or attention scores.
create or replace function public.admin_learning_sensor_summary(p_days int default 7)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare since_time timestamptz; result jsonb;
begin
  if public.is_platform_admin() is distinct from true then raise exception 'forbidden'; end if;
  if p_days is null or p_days not between 1 and 90 then raise exception 'bad_days'; end if;
  since_time:=now()-make_interval(days=>p_days);
  select jsonb_build_object('schema_version','sensor-v1','days',p_days,'generated_at',now(),
    'sources',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
      select source,count(*) as events,count(distinct student_id) as students,
        count(*) filter(where action='shown') as shown,
        sum(visible_ms) as visible_ms,sum(input_recent_ms) as input_recent_ms,max(received_at) as last_received_at
      from public.learning_sensor_events where received_at>=since_time group by source order by source
    ) x),
    'evidence',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
      select source,count(*) as responses,count(*) filter(where first_attempt) as first_responses,
        count(*) filter(where first_attempt and correct) as first_correct,
        count(*) filter(where helped is null) as help_unknown
      from public.learning_sensor_outcomes where observed_at>=since_time group by source order by source
    ) x)) into result;
  return result;
end $$;
revoke all on function public.admin_learning_sensor_summary(int) from public,anon,authenticated;
grant execute on function public.admin_learning_sensor_summary(int) to authenticated;
commit;
