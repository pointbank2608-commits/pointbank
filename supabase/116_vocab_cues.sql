-- Versioned vocabulary cue paths. The 115 spelling paths keep their own engine.
begin;

create table if not exists public.learning_vocab_cue_plans (
  lesson_id uuid primary key references public.learning_path_plans(lesson_id) on delete cascade,
  config jsonb not null
);
create table if not exists public.learning_vocab_class_schedules (
  class_id uuid primary key references public.classes(id) on delete cascade,
  class_days int[] not null,
  review_days int[] not null,
  revision int not null default 1
);
alter table public.learning_vocab_class_schedules enable row level security;
revoke all on public.learning_vocab_class_schedules from public,anon,authenticated;
create table if not exists public.learning_vocab_cue_states (
  assignment_id uuid primary key references public.solo_assignments(id) on delete cascade,
  phase text not null,
  queue int[] not null,
  gaps int[] not null default '{}',
  remaining int[] not null default '{}',
  unobserved int[] not null default '{}',
  targets int[] not null default '{}',
  carry int[] not null default '{}',
  session_day int not null default 0 check (session_day in (0,1,3,7)),
  revision int not null default 0,
  cycle int not null default 1
);
create table if not exists public.learning_vocab_cue_actions (
  id uuid primary key,
  assignment_id uuid not null references public.learning_vocab_cue_states(assignment_id) on delete cascade,
  run_id uuid not null,
  position int not null,
  revision int not null,
  pair int not null,
  mode text not null,
  phase text not null,
  cycle int not null,
  session_day int not null,
  correct boolean,
  action text not null,
  response text,
  recorded_at timestamptz not null default clock_timestamp(),
  result jsonb not null,
  foreign key (run_id) references public.learning_delivery_runs(id)
);
create unique index if not exists learning_vocab_cue_revision on public.learning_vocab_cue_actions(assignment_id,revision);
create index if not exists learning_vocab_cue_answer_history on public.learning_vocab_cue_actions(assignment_id,pair,phase,revision desc);
alter table public.learning_vocab_cue_plans enable row level security;
alter table public.learning_vocab_cue_states enable row level security;
alter table public.learning_vocab_cue_actions enable row level security;
revoke all on public.learning_vocab_cue_plans,public.learning_vocab_cue_states,public.learning_vocab_cue_actions from public,anon,authenticated;

create or replace function public.learning_vocab_next_day(p_days int[],p_first date) returns date
language sql immutable set search_path=public as $$
  select min(p_first+n) from generate_series(0,6) n where extract(isodow from p_first+n)::int=any(p_days)
$$;

create or replace function public.learning_vocab_schedule_read(p_class uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy(); s public.learning_vocab_class_schedules;
  today date:=(now() at time zone 'Asia/Seoul')::date;
begin
  if not public.academy_feature(ac,'solo') then raise exception 'feature_closed'; end if;
  if not exists(select 1 from public.classes where id=p_class and academy_id=ac) then raise exception 'bad_class'; end if;
  select * into s from public.learning_vocab_class_schedules where class_id=p_class;
  return jsonb_build_object('revision',coalesce(s.revision,0),'class_days',coalesce(s.class_days,'{}'),
    'review_days',coalesce(s.review_days,'{}'),'today',today,
    'next_class_on',public.learning_vocab_next_day(s.class_days,today+1),
    'next_review_on',public.learning_vocab_next_day(s.review_days,today+1));
end$$;

create or replace function public.learning_vocab_schedule_save(p_class uuid,p_revision int,p_class_days int[],p_review_days int[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy(); old_revision int;
begin
  perform public.learning_vocab_schedule_read(p_class);
  if coalesce(cardinality(p_class_days),0) not between 1 and 7 or p_review_days is null
    or cardinality(p_review_days)>7 or array_position(p_class_days,null) is not null or array_position(p_review_days,null) is not null
    or not (p_class_days <@ array[1,2,3,4,5,6,7]) or not (p_review_days <@ array[1,2,3,4,5,6,7])
    then raise exception 'bad_schedule_days'; end if;
  perform pg_advisory_xact_lock(hashtextextended('vocab-cues:'||ac::text||':'||p_class::text,0));
  select revision into old_revision from public.learning_vocab_class_schedules where class_id=p_class;
  if p_revision is distinct from coalesce(old_revision,0) then raise exception 'schedule_changed'; end if;
  insert into public.learning_vocab_class_schedules(class_id,class_days,review_days)
    values(p_class,array(select distinct d from unnest(p_class_days) d order by d),
      array(select distinct d from unnest(p_review_days) d order by d))
    on conflict(class_id) do update set class_days=excluded.class_days,review_days=excluded.review_days,
      revision=learning_vocab_class_schedules.revision+1;
  return public.learning_vocab_schedule_read(p_class);
end$$;

create or replace function public.learning_vocab_freeze_timetable(p_class uuid,p_input jsonb,p_cards jsonb,p_modes text[],p_homework boolean,p_due timestamptz)
returns jsonb language plpgsql stable set search_path=public as $$
declare prefs public.learning_vocab_class_schedules; required int[]; opens date; next_class date;
  local_today date:=(now() at time zone 'Asia/Seoul')::date; starts_at timestamptz; cutoff timestamptz;
begin
  if jsonb_typeof(p_input) is distinct from 'object' or jsonb_typeof(p_input->'essential') is distinct from 'array'
    or jsonb_array_length(p_input->'essential')>36 then raise exception 'bad_timetable'; end if;
  select * into prefs from public.learning_vocab_class_schedules where class_id=p_class;
  if p_input->'revision' is distinct from to_jsonb(coalesce(prefs.revision,0)) then raise exception 'schedule_changed'; end if;
  begin
    opens:=(p_input->>'opens_on')::date;
    next_class:=(p_input->>'next_class_on')::date;
  exception when invalid_datetime_format or datetime_field_overflow then raise exception 'bad_schedule_date';
  end;
  if opens is not null and (opens<local_today or opens>local_today+60) then raise exception 'bad_schedule_date'; end if;
  if next_class is not null and (next_class<=coalesce(opens,local_today) or next_class>local_today+60)
    then raise exception 'bad_next_class_date'; end if;
  if next_class is null and not p_homework then
    next_class:=public.learning_vocab_next_day(prefs.class_days,coalesce(opens,local_today)+1);
  end if;
  starts_at:=opens::timestamp at time zone 'Asia/Seoul';
  if p_due is not null and starts_at>p_due then raise exception 'bad_open_after_deadline'; end if;
  select coalesce(array_agg(distinct ((c.ord-1)*3+m.idx)::int order by ((c.ord-1)*3+m.idx)::int),'{}') into required
  from jsonb_array_elements(p_cards) with ordinality c(card,ord)
  cross join (values ('spell',0),('listen',1),('read',2)) m(mode,idx)
  join lateral jsonb_array_elements(p_input->'essential') e(goal) on
    e.goal->>'word'=c.card->>'word' and e.goal->>'meaning'=c.card->>'meaning' and e.goal->>'mode'=m.mode
  where m.mode=any(p_modes) and not p_homework;
  if cardinality(required)<>jsonb_array_length(p_input->'essential') then raise exception 'bad_essential_goal'; end if;
  if cardinality(required)>0 then
    cutoff:=least(greatest(now(),starts_at)+interval '24 hours',next_class::timestamp at time zone 'Asia/Seoul');
  end if;
  return jsonb_build_object('rule','class-timetable-v1','class_days',prefs.class_days,'review_days',prefs.review_days,
    'starts_at',starts_at,'next_class_on',next_class,'focus_due_at',cutoff,'required_pairs',required);
end$$;

create or replace function public.learning_vocab_cue_sentence_key(p_sentence text) returns text
language sql immutable as $$ select regexp_replace(lower(coalesce(p_sentence,'')),'[^a-z0-9]','','g') $$;

-- Do not let an older client approve a cue proposal as a spelling-only plan.
create or replace function public.learning_vocab_cue_guard_approval() returns trigger
language plpgsql set search_path=public as $$
begin
  if exists(select 1 from public.learning_vocab_drafts where id=new.draft_id and proposal ? 'cue')
    and current_setting('app.vocab_cue_approval',true) is distinct from new.request_id::text then
    raise exception 'use_vocab_cues';
  end if;
  return new;
end$$;
drop trigger if exists learning_vocab_cue_guard_approval on public.learning_vocab_approvals;
create trigger learning_vocab_cue_guard_approval before insert on public.learning_vocab_approvals
for each row execute function public.learning_vocab_cue_guard_approval();

create or replace function public.learning_vocab_cue_guard_legacy() returns trigger
language plpgsql set search_path=public as $$
begin
  if exists(select 1 from public.solo_assignments a join public.learning_vocab_cue_plans p on p.lesson_id=a.lesson_id
    where a.id=new.assignment_id) then raise exception 'use_vocab_cues'; end if;
  return new;
end$$;
drop trigger if exists learning_vocab_cue_guard_legacy on public.learning_path_requests;
create trigger learning_vocab_cue_guard_legacy before insert on public.learning_path_requests
for each row execute function public.learning_vocab_cue_guard_legacy();

-- The actual positions reported to the common sensor are indexed against the
-- frozen snapshot, alongside the original path's positions.
create or replace function public.learning_vocab_cue_index_run() returns trigger
language plpgsql security definer set search_path=public as $$
declare items jsonb; item record;
begin
  if new.source<>'solo' then return new; end if;
  select definition->'grading'->'steps'->0->'cue_items' into items
    from public.learning_sensor_snapshots where id=new.snapshot_id;
  for item in select * from jsonb_each(coalesce(items,'{}')) loop
    perform public.learning_delivery_item(new.id,item.key::int,-1,item.value);
  end loop;
  return new;
end$$;
drop trigger if exists learning_vocab_cue_index_run on public.learning_delivery_runs;
create trigger learning_vocab_cue_index_run after insert on public.learning_delivery_runs
for each row execute function public.learning_vocab_cue_index_run();

create or replace function public.learning_vocab_cue_choices(p_cards jsonb,p_card jsonb,p_context boolean)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_agg(value order by priority,value) from (
    select value,min(priority) as priority from (
      select p_card->>'meaning' as value,0 as priority
      union all select w.meaning,1 from public.word_bank w where p_context and lower(w.word)=p_card->>'word'
      union all select other->>'meaning',2 from jsonb_array_elements(p_cards) other
        where p_context or other->>'word'<>p_card->>'word'
      union all select fallback,3 from unnest(array['동물','장소','물건','날씨']) fallback
    ) pool where length(btrim(value)) between 1 and 120 group by value order by min(priority),value limit 4
  ) options
$$;

-- Position is 100 + word index * 15 + mode index * 5 + presentation.
create or replace function public.learning_vocab_cue_items(p_cards jsonb,p_modes text[],p_games boolean,p_contexts jsonb,p_contextual boolean)
returns jsonb language sql stable set search_path=public as $$
  with materials as materialized (
    select value as card,(ordinality-1)::int as idx,
      public.learning_vocab_cue_choices(p_cards,value,false) as bare_choices,
      public.learning_vocab_cue_choices(p_cards,value,true) as context_choices
    from jsonb_array_elements(p_cards) with ordinality
  ), items as (
    select 100+c.idx*15+m.offset_id*5+s.slot as position,
      c.card||jsonb_build_object('t','cue_'||m.mode,'mode',m.mode,'skill','vocab.cue.'||m.mode,'word_index',c.idx,
        'choices',case when p_contextual and m.mode='read' then c.context_choices else c.bare_choices end,
        'sentence',case when p_contextual and m.mode='read' then c.card->>'example' end,
        'game',case when p_games and s.slot=2 then case when m.mode='spell' then 'train' else 'balloon' end end)
      as item
    from materials c cross join (values ('spell',0),('listen',1),('read',2)) m(mode,offset_id)
    cross join generate_series(0,3) s(slot)
    where p_contexts is null and m.mode=any(p_modes)
    union all
    select 104+c.idx*15,c.card||jsonb_build_object('t','cue_context','mode','context','skill','vocab.cue.context','word_index',c.idx,
      'choices',c.context_choices,'sentence',p_contexts->c.idx->>'sentence')
    from materials c where p_contexts is not null
  )
  select coalesce(jsonb_object_agg(position::text,item),'{}'::jsonb) from items
$$;

create or replace function public.learning_vocab_cue_approve_plan(
  p_request uuid,p_class uuid,p_students uuid[],p_title text,p_cards jsonb,p_modes text[],
  p_games boolean,p_draft uuid,p_due timestamptz,p_contexts jsonb,p_contextual boolean,p_timetable jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy(); d public.learning_vocab_drafts; config jsonb;
  result jsonb; target uuid; previous jsonb; cards jsonb; item record; sentence text; key text; old_gate text; timetable jsonb;
begin
  if p_request is null or p_games is null or p_contextual is null then raise exception 'bad_cue_plan'; end if;
  if p_draft is not null then
    select proposal.* into d from public.learning_vocab_drafts proposal join public.learning_path_plans source on source.lesson_id=proposal.source_lesson
      where proposal.id=p_draft and source.academy_id=ac and source.class_id=p_class;
    if not found or not (d.proposal ? 'cue') then raise exception 'bad_cue_draft'; end if;
  end if;
  if d.kind='homework' then
    if jsonb_typeof(p_contexts) is distinct from 'array' or jsonb_typeof(p_cards) is distinct from 'array'
      or jsonb_array_length(p_contexts)<>jsonb_array_length(p_cards) then raise exception 'bad_context_count'; end if;
  elsif p_contexts is not null or coalesce(cardinality(p_modes),0)=0 or array_position(p_modes,null) is not null
    or not (p_modes <@ array['spell','listen','read']) then raise exception 'bad_cue_modes';
  end if;
  if p_contextual and (d.kind is distinct from 'lesson' or not ('read'=any(p_modes))) then raise exception 'bad_context_mode'; end if;
  config:=jsonb_build_object('version','cue-v1','review_rule','adaptive-spaced-v1','modes',to_jsonb(p_modes),'games',p_games,
    'contexts',p_contexts,'contextual',p_contextual);
  -- Serialize context approvals in the same class, including different draft IDs.
  perform pg_advisory_xact_lock(hashtextextended('vocab-cues:'||ac::text||':'||p_class::text,0));
  select cp.config into previous from public.learning_vocab_approvals a
    join public.learning_vocab_cue_plans cp on cp.lesson_id=a.lesson_id
    where a.academy_id=ac and a.request_id=p_request;
  if found and ((previous-'timetable'-'timetable_input') is distinct from config
    or previous->'timetable_input' is distinct from p_timetable) then raise exception 'request_changed'; end if;
  old_gate:=current_setting('app.vocab_cue_approval',true);
  perform set_config('app.vocab_cue_approval',p_request::text,true);
  result:=public.learning_vocab_approve(p_request,p_class,p_students,p_title,p_cards,'letters',p_games,p_draft,p_due);
  perform set_config('app.vocab_cue_approval',coalesce(old_gate,''),true);
  target:=(result->>'lesson_id')::uuid;
  if (result->>'duplicate')::boolean then
    if previous is null then raise exception 'request_changed'; end if;
    return result;
  end if;
  select p.cards into cards from public.learning_path_plans p where p.lesson_id=target;
  if p_timetable is not null then
    timetable:=public.learning_vocab_freeze_timetable(p_class,p_timetable,cards,p_modes,coalesce(d.kind='homework',false),p_due);
    config:=config||jsonb_build_object('timetable_input',p_timetable,'timetable',timetable);
  end if;
  if p_contextual and exists(select 1 from jsonb_array_elements(cards) card where
    not coalesce(card->>'example' ~* ('\m'||(card->>'word')||'\M'),false) or length(card->>'example')<8)
    then raise exception 'bad_context_example'; end if;
  if p_contexts is not null then
    for item in select value as card,(ordinality-1)::int as idx from jsonb_array_elements(cards) with ordinality loop
      sentence:=btrim(coalesce(p_contexts->item.idx->>'sentence',''));
      key:=public.learning_vocab_cue_sentence_key(sentence);
      if length(sentence) not between 8 and 250 or length(key)<5 or sentence ~ '[가-힣]'
        or p_contexts->item.idx->>'word' is distinct from item.card->>'word'
        or p_contexts->item.idx->>'meaning' is distinct from item.card->>'meaning'
        or sentence !~* ('\m'||(item.card->>'word')||'\M')
        or not exists(select 1 from public.learning_path_plans p,jsonb_array_elements(p.cards) original
          where p.lesson_id=d.source_lesson and original->>'word'=item.card->>'word' and original->>'meaning'=item.card->>'meaning')
        then raise exception 'bad_context_sentence'; end if;
      if exists(select 1 from public.learning_path_plans p,jsonb_array_elements(p.cards) original
          where p.lesson_id=d.source_lesson and public.learning_vocab_cue_sentence_key(original->>'example')=key)
        or exists(select 1 from jsonb_array_elements(p_contexts) with ordinality others(value,ord)
          where others.ord<>item.idx+1 and public.learning_vocab_cue_sentence_key(others.value->>'sentence')=key)
        or exists(select 1 from public.learning_path_plans p cross join lateral jsonb_array_elements(p.cards) old_card
          where p.academy_id=ac and p.lesson_id<>target and public.learning_vocab_cue_sentence_key(old_card->>'example')=key
            and exists(select 1 from public.solo_assignments a where a.lesson_id=p.lesson_id and a.student_id=any(p_students)))
        or exists(select 1 from public.learning_vocab_cue_plans cp join public.learning_path_plans p on p.lesson_id=cp.lesson_id
          cross join lateral jsonb_array_elements(case when jsonb_typeof(cp.config->'contexts')='array' then cp.config->'contexts' else '[]'::jsonb end) old
          where p.academy_id=ac and public.learning_vocab_cue_sentence_key(old->>'sentence')=key
            and exists(select 1 from public.solo_assignments a where a.lesson_id=p.lesson_id and a.student_id=any(p_students)))
        then raise exception 'bad_context_reused'; end if;
    end loop;
  end if;
  update public.solo_lessons
    set steps=jsonb_set(steps,'{0}',steps->0||jsonb_build_object('cue_version','cue-v1',
      'cue_items',public.learning_vocab_cue_items(cards,p_modes,p_games,p_contexts,p_contextual))
      ||case when timetable is null then '{}'::jsonb else jsonb_build_object('cue_timetable',timetable) end)
    where id=target;
  insert into public.learning_vocab_cue_plans values(target,config);
  return result;
end$$;

create or replace function public.learning_vocab_cue_approve(
  p_request uuid,p_class uuid,p_students uuid[],p_title text,p_cards jsonb,p_modes text[],
  p_games boolean,p_draft uuid default null,p_due timestamptz default null,p_contexts jsonb default null,p_contextual boolean default false
) returns jsonb language sql security definer set search_path=public as $$
  select public.learning_vocab_cue_approve_plan(p_request,p_class,p_students,p_title,p_cards,p_modes,p_games,
    p_draft,p_due,p_contexts,p_contextual,null)
$$;

create or replace function public.learning_vocab_cue_approve_scheduled(
  p_request uuid,p_class uuid,p_students uuid[],p_title text,p_cards jsonb,p_modes text[],
  p_games boolean,p_draft uuid,p_due timestamptz,p_contexts jsonb,p_contextual boolean,p_timetable jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if p_timetable is null then raise exception 'bad_timetable'; end if;
  return public.learning_vocab_cue_approve_plan(p_request,p_class,p_students,p_title,p_cards,p_modes,p_games,
    p_draft,p_due,p_contexts,p_contextual,p_timetable);
end$$;

create or replace function public.learning_vocab_cue_timetable(p_run uuid) returns jsonb
language sql stable set search_path=public as $$
  select s.definition->'grading'->'steps'->0->'cue_timetable'
  from public.learning_delivery_runs r join public.learning_sensor_snapshots s on s.id=r.snapshot_id where r.id=p_run
$$;

create or replace function public.learning_vocab_cue_frozen(p_run uuid) returns jsonb
language sql stable set search_path=public as $$
  select s.definition->'grading'->'steps'->0->'cue_items'
  from public.learning_delivery_runs r join public.learning_sensor_snapshots s on s.id=r.snapshot_id where r.id=p_run
$$;

create or replace function public.learning_vocab_cue_support(p_assignment uuid,p_pair int,p_items jsonb,p_item jsonb,p_extended boolean)
returns jsonb language plpgsql stable set search_path=public as $$
declare attempt text; contrast jsonb; mode text:=p_item->>'mode';
begin
  select response into attempt from public.learning_vocab_cue_actions
    where assignment_id=p_assignment and pair=p_pair and phase in ('diagnostic','check','review') and correct=false
    order by revision desc limit 1;
  if mode='spell' then
    if attempt ~ '^[A-Za-z-]{1,40}$' and lower(attempt)<>p_item->>'word' then
      return jsonb_build_object('kind','spell_compare','attempt',lower(attempt));
    end if;
    if p_extended then return jsonb_build_object('kind','spell_chunks'); end if;
  elsif mode in ('listen','read') and attempt is not null then
    select value into contrast from jsonb_each(p_items) where value->>'meaning'=attempt and value->>'word'<>p_item->>'word'
      order by key::int limit 1;
    if contrast is not null then
      return jsonb_build_object('kind',mode||'_contrast','word',contrast->>'word','meaning',contrast->>'meaning');
    end if;
  end if;
  if p_extended and mode='listen' then return jsonb_build_object('kind','listen_slow'); end if;
  if p_extended and mode='read' and p_item->>'example' is not null then return jsonb_build_object('kind','read_example'); end if;
  return null;
end$$;

create or replace function public.learning_vocab_cue_payload(p_assignment uuid) returns jsonb
language plpgsql stable set search_path=public as $$
declare state public.learning_vocab_cue_states; path public.learning_path_states; pos int; q jsonb; public_item jsonb; items jsonb; timetable jsonb;
begin
  select * into state from public.learning_vocab_cue_states where assignment_id=p_assignment;
  select * into path from public.learning_path_states where assignment_id=p_assignment;
  timetable:=public.learning_vocab_cue_timetable(path.run_id);
  pos:=100+state.queue[1]*5+case state.phase when 'diagnostic' then 0 when 'learn' then 1
    when 'practice' then 2 when 'context' then 4 else 3 end;
  if path.finished_at is null and (path.due_at is null or path.due_at<=now()) then
    items:=public.learning_vocab_cue_frozen(path.run_id);
    q:=items->pos::text;
    if q is not null then
      public_item:=jsonb_build_object('mode',q->>'mode','game',q->>'game','word_index',q->'word_index',
        'essential',coalesce(timetable->'required_pairs' @> jsonb_build_array(state.queue[1]),false),
        'support',case when state.phase='learn' and timetable is not null
          then public.learning_vocab_cue_support(p_assignment,state.queue[1],items,q,state.cycle>1 or state.session_day>0) end,
        'text',case when state.phase<>'learn' and q->>'sentence' is not null then q->>'sentence'
          when q->>'mode'='read' or state.phase='learn' then q->>'word'
          when q->>'mode'='spell' then q->>'meaning' end,
        'target',case when state.phase<>'learn' and q->>'sentence' is not null then q->>'word' end,
        'audio',case when q->>'mode'='listen' or state.phase='learn' then q->>'word' end,
        'meaning',case when state.phase='learn' then q->>'meaning' end,
        'image',case when state.phase='learn' then q->>'imageUrl' end,
        'example',case when state.phase='learn' then q->>'example' end,
        'choices',case when state.phase<>'learn' and q->>'mode'<>'spell' then
          (select jsonb_agg(choice order by md5(choice||p_assignment::text||state.revision::text))
            from jsonb_array_elements_text(q->'choices') choice) end,
        'letters',case when q->>'game'='train' then
          (select jsonb_agg(letter order by md5(ord::text||p_assignment::text||state.revision::text))
            from regexp_split_to_table(q->>'word','') with ordinality x(letter,ord)) end);
    end if;
  end if;
  return jsonb_build_object('run_id',path.run_id,'phase',state.phase,'revision',state.revision,'round',path.round,
    'position',pos,'item',public_item,'finished',path.finished_at is not null,'due_at',path.due_at,'session_day',state.session_day,
    'starts_at',timetable->'starts_at','focus_due_at',timetable->'focus_due_at','next_class_on',timetable->'next_class_on',
    'waiting',coalesce(path.due_at>now(),false),'gap_count',cardinality(state.gaps),
    'verified_count',cardinality(state.gaps)-cardinality(state.remaining));
end$$;

create or replace function public.learning_vocab_cue_open(p_token uuid,p_assignment uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.solo_assignments; receipt jsonb; items jsonb; queue int[]; timetable jsonb;
begin
  a:=public.solo_assignment_for(p_token,p_assignment);
  if not exists(select 1 from public.learning_vocab_cue_plans where lesson_id=a.lesson_id) then return null; end if;
  perform 1 from public.solo_assignments where id=a.id for update;
  receipt:=public.learning_path_open(p_token,p_assignment);
  items:=public.learning_vocab_cue_frozen((receipt->>'run_id')::uuid);
  timetable:=public.learning_vocab_cue_timetable((receipt->>'run_id')::uuid);
  if items is null then raise exception 'cue_version_missing'; end if;
  select array_agg((key::int-100)/5 order by exists(
    select 1 from jsonb_array_elements_text(coalesce(timetable->'required_pairs','[]')) e
      where e::int/3=(key::int-100)/15
    ) desc,((key::int-100)/5)%3,
    coalesce(timetable->'required_pairs' @> jsonb_build_array((key::int-100)/5),false) desc,
    md5(key||a.id::text),key::int) into queue from jsonb_object_keys(items) key
    where (key::int-100)%5=case when a.kind='homework' then 4 else 0 end;
  insert into public.learning_vocab_cue_states(assignment_id,phase,queue)
    values(a.id,case when a.kind='homework' then 'context' else 'diagnostic' end,queue) on conflict do nothing;
  if found and (timetable->>'starts_at')::timestamptz>now() then
    update public.learning_path_states set due_at=(timetable->>'starts_at')::timestamptz where assignment_id=a.id;
  end if;
  return public.learning_vocab_cue_payload(a.id);
end$$;

create or replace function public.learning_vocab_cue_action(p_token uuid,p_assignment uuid,p_request uuid,p_revision int,p_action text,p_value text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.solo_assignments; state public.learning_vocab_cue_states; path public.learning_path_states;
  prev public.learning_vocab_cue_actions; q jsonb; items jsonb; pos int; pair int; remaining_queue int[];
  correct boolean; result jsonb; next_phase text; next_cycle int;
  schedule boolean:=false; new_day int; retry_pairs int[]; essential int[]; timetable jsonb; support jsonb;
  review_days int[]; review_on date; focus_due timestamptz;
begin
  a:=public.solo_assignment_for(p_token,p_assignment);
  perform 1 from public.solo_assignments where id=a.id for update;
  select * into state from public.learning_vocab_cue_states where assignment_id=a.id;
  select * into path from public.learning_path_states where assignment_id=a.id;
  if state.assignment_id is null or p_request is null then raise exception 'not_found'; end if;
  select * into prev from public.learning_vocab_cue_actions where id=p_request;
  if found then
    if (prev.assignment_id,prev.revision,prev.action,prev.response) is distinct from (a.id,p_revision,p_action,p_value)
      then raise exception 'bad_request'; end if;
    return prev.result;
  end if;
  if p_revision is distinct from state.revision or path.finished_at is not null then raise exception 'path_changed'; end if;
  if path.due_at>now() then raise exception 'not_due'; end if;
  if length(p_value)>300 then raise exception 'bad_answer'; end if;
  pair:=state.queue[1];
  pos:=100+pair*5+case state.phase when 'diagnostic' then 0 when 'learn' then 1
    when 'practice' then 2 when 'context' then 4 else 3 end;
  items:=public.learning_vocab_cue_frozen(path.run_id);
  timetable:=public.learning_vocab_cue_timetable(path.run_id);
  essential:=array(select x::int from jsonb_array_elements_text(coalesce(timetable->'required_pairs','[]')) x);
  focus_due:=(timetable->>'focus_due_at')::timestamptz;
  q:=items->pos::text;
  if q is null then raise exception 'cue_version_missing'; end if;
  if state.phase='learn' then
    if p_action is distinct from 'continue' then raise exception 'bad_action'; end if;
    if timetable is not null then
      support:=public.learning_vocab_cue_support(a.id,pair,items,q,state.cycle>1 or state.session_day>0);
    end if;
  elsif p_action='unavailable' and q->>'mode'='listen' then
    correct:=null;
  elsif p_action='unknown' then
    correct:=false;
  elsif p_action='answer' then
    if q->>'mode'='spell' then correct:=public.solo_norm(p_value)=q->>'word';
    elsif p_value is not null and q->'choices' ? p_value then correct:=p_value=q->>'meaning';
    else raise exception 'bad_answer_choice'; end if;
  else raise exception 'bad_action'; end if;

  next_phase:=state.phase;
  next_cycle:=state.cycle;
  remaining_queue:=coalesce(state.queue[2:], '{}');
  if state.phase='diagnostic' and correct=false then
    state.gaps:=array_append(state.gaps,pair);
    state.remaining:=array_append(state.remaining,pair);
  elsif state.phase='diagnostic' and correct is null then
    state.unobserved:=array_append(state.unobserved,pair);
  elsif state.phase in ('check','review') then
    if state.phase='review' then
      if correct is not null then state.unobserved:=array_remove(state.unobserved,pair);
      elsif not pair=any(state.unobserved) then state.unobserved:=array_append(state.unobserved,pair); end if;
    end if;
    if correct=true then
      state.remaining:=array_remove(state.remaining,pair);
      state.carry:=array_remove(state.carry,pair);
    elsif correct=false then
      if pair=any(state.gaps) and not pair=any(state.remaining) then state.remaining:=array_append(state.remaining,pair); end if;
      if state.session_day>0 and not pair=any(state.carry) then state.carry:=array_append(state.carry,pair); end if;
      if state.phase='review' and state.session_day<7 then state.targets:=array_append(state.targets,pair); end if;
    end if;
  end if;

  if state.phase='learn' then
    remaining_queue:=state.queue;
    next_phase:='practice';
  elsif state.phase='practice' then
    if cardinality(remaining_queue)>0 then next_phase:='learn';
    else remaining_queue:=state.targets; next_phase:='check'; end if;
  elsif cardinality(remaining_queue)=0 then
    if state.phase='context' then
      path.first_completed_at:=now();
      path.finished_at:=now();
    elsif state.phase='diagnostic' and cardinality(state.gaps)>0 then
      select array_agg(x order by (x=any(essential)) desc,ord) into remaining_queue
        from unnest(state.remaining) with ordinality pending(x,ord);
      state.targets:=remaining_queue;
      next_phase:='learn';
    elsif state.phase='review' and state.session_day<7 and cardinality(state.targets)>0 then
      remaining_queue:=state.targets;
      next_phase:='learn';
    elsif state.phase='check' and state.session_day=0 and state.cycle<3
      and (focus_due is null or now()<focus_due) then
      -- Give essential gaps a different explanation even above the 80% target.
      -- A third round requires evidence of supported success in the latest round.
      select coalesce(array_agg(x order by (x=any(essential)) desc,x),'{}') into retry_pairs
      from unnest(state.remaining) x
      where not (x=pair and p_action='unavailable') and exists (
        select 1 from public.learning_vocab_cue_actions e where e.assignment_id=a.id and e.pair=x
          and e.session_day=0 and e.cycle=state.cycle and e.phase='practice' and e.action<>'unavailable'
          and ((x=any(essential) and (state.cycle=1 or e.correct))
            or (state.cycle=1 and e.correct and 5*(cardinality(state.gaps)-cardinality(state.remaining))<4*cardinality(state.gaps)))
      ) and not exists(select 1 from public.learning_vocab_cue_actions e where e.assignment_id=a.id and e.pair=x
        and e.session_day=0 and e.cycle=state.cycle and e.phase='check' and e.action='unavailable');
      if cardinality(retry_pairs)>0 then
        state.targets:=retry_pairs;
        remaining_queue:=retry_pairs;
        next_phase:='learn';
        next_cycle:=state.cycle+1;
      else schedule:=true; end if;
    elsif state.session_day<7 then
      schedule:=true;
    else
      path.finished_at:=now();
      path.due_at:=null;
    end if;
  end if;

  if schedule then
    path.first_completed_at:=coalesce(path.first_completed_at,now());
    if jsonb_typeof(timetable->'review_days')='array' and jsonb_array_length(timetable->'review_days')=0 then
      path.finished_at:=now();
      path.due_at:=null;
    else
    new_day:=case
      when state.session_day=0 and cardinality(state.gaps||state.unobserved)>0 then 1
      when state.session_day=1 and cardinality(state.remaining||state.carry||state.unobserved)>0 then 3
      else 7 end;
    if new_day=1 then remaining_queue:=state.gaps||state.unobserved;
    elsif new_day=3 then
      select array_agg(distinct target order by target) into remaining_queue from unnest(state.remaining||state.carry||state.unobserved) target;
    else
      -- Recheck all initial gaps plus at most one other pair per enabled cue.
      select array_agg(distinct target order by target) into remaining_queue from (
        select unnest(state.gaps||state.carry||state.unobserved) as target
        union
        select min((key::int-100)/5) from jsonb_object_keys(items) key
          where (key::int-100)%5=3 and not ((key::int-100)/5)=any(state.gaps||state.carry||state.unobserved)
          group by ((key::int-100)/5)%3
      ) review_targets;
    end if;
    path.round:=case when new_day=7 then 2 else 1 end;
    if jsonb_typeof(timetable->'review_days')='array' then
      review_days:=array(select value::int from jsonb_array_elements_text(timetable->'review_days'));
      review_on:=public.learning_vocab_next_day(review_days,greatest(
        (path.first_completed_at at time zone 'Asia/Seoul')::date+new_day,(now() at time zone 'Asia/Seoul')::date+1));
      path.due_at:=review_on::timestamp at time zone 'Asia/Seoul';
    else
      path.due_at:=greatest(path.first_completed_at+make_interval(days=>new_day),now()+interval '1 day');
    end if;
    next_phase:='review';
    next_cycle:=new_day;
    end if;
  end if;

  update public.learning_vocab_cue_states set queue=remaining_queue,gaps=state.gaps,remaining=state.remaining,
    targets=case when schedule then '{}' else state.targets end,unobserved=state.unobserved,carry=state.carry,
    session_day=coalesce(new_day,state.session_day),phase=next_phase,cycle=next_cycle,revision=revision+1 where assignment_id=a.id;
  update public.learning_path_states set first_completed_at=path.first_completed_at,due_at=path.due_at,
    finished_at=path.finished_at,round=path.round,updated_at=now() where assignment_id=a.id;
  if path.finished_at is not null then update public.solo_assignments set finished_at=path.finished_at,
    progress=(select jsonb_array_length(steps) from public.solo_lessons where id=a.lesson_id) where id=a.id; end if;
  result:=jsonb_build_object('state',public.learning_vocab_cue_payload(a.id),'correct',correct,
    'unavailable',p_action='unavailable','feedback',state.phase in ('practice','check','review','context'),
    'support',support,
    'answer',case when state.phase='practice' and correct=false then
      case when q->>'mode'='spell' then q->>'word' else q->>'meaning' end end);
  insert into public.learning_vocab_cue_actions(id,assignment_id,run_id,position,revision,pair,mode,phase,cycle,session_day,correct,action,response,result)
    values(p_request,a.id,path.run_id,pos,p_revision,pair,q->>'mode',state.phase,state.cycle,state.session_day,correct,p_action,p_value,result);
  return result;
end$$;

-- Read server-graded answers only. Unavailable audio is retained as missing
-- and game or explanation actions are never promoted to assessment evidence.
create or replace function public.learning_vocab_cue_rows(p_lesson uuid)
returns table(student_id uuid,student_name text,goal_index int,card jsonb,cues jsonb,
  context_id uuid,context_correct boolean,ready boolean,gap_count int,verified_count int)
language sql stable set search_path=public as $$
  select a.student_id,st.name,c.idx,c.card,cue.results,hw.id,hw.correct,path.first_completed_at is not null,
    cardinality(state.gaps),cardinality(state.gaps)-cardinality(state.remaining)
  from public.learning_path_plans p
  join public.learning_vocab_cue_plans cp on cp.lesson_id=p.lesson_id
  join public.solo_assignments a on a.lesson_id=p.lesson_id and a.kind='lesson' and a.academy_id=p.academy_id
  join public.students st on st.id=a.student_id and st.class_id=p.class_id and st.academy_id=p.academy_id and st.archived_at is null
  cross join lateral (select value card,(ordinality-1)::int idx from jsonb_array_elements(p.cards) with ordinality) c
  left join public.learning_path_states path on path.assignment_id=a.id
  left join public.learning_vocab_cue_states state on state.assignment_id=a.id
  left join lateral (
    select jsonb_object_agg(m.mode,jsonb_build_object('first',diagnostic.correct,'check',checked.correct,
      'review',review.correct,'round',review.cycle,'review_on',review.review_on,
      'unavailable',recent.action='unavailable',
      'essential',coalesce(cp.config->'timetable'->'required_pairs' @> jsonb_build_array(c.idx*3+m.offset_id),false),
      'before_deadline',before_deadline.correct,'deadline_unavailable',before_deadline.action='unavailable',
      'latest',coalesce(latest.correct,diagnostic.correct))) results
    from (values ('spell',0),('listen',1),('read',2)) m(mode,offset_id)
    left join lateral (select x.correct,x.action from public.learning_vocab_cue_actions x
      where x.assignment_id=a.id and x.pair=c.idx*3+m.offset_id and x.phase='diagnostic' limit 1) diagnostic on true
    left join lateral (select x.correct,x.action from public.learning_vocab_cue_actions x
      where x.assignment_id=a.id and x.pair=c.idx*3+m.offset_id and x.phase='check'
      order by x.revision desc limit 1) checked on true
    left join lateral (select x.correct,x.cycle,(x.recorded_at at time zone 'Asia/Seoul')::date as review_on
      from public.learning_vocab_cue_actions x
      where x.assignment_id=a.id and x.pair=c.idx*3+m.offset_id and x.phase='review'
      order by x.revision desc limit 1) review on true
    left join lateral (select x.action from public.learning_vocab_cue_actions x
      where x.assignment_id=a.id and x.pair=c.idx*3+m.offset_id and x.phase in ('diagnostic','check','review')
      order by x.revision desc limit 1) recent on true
    left join lateral (select x.correct from public.learning_vocab_cue_actions x
      where x.assignment_id=a.id and x.pair=c.idx*3+m.offset_id and x.phase in ('check','review') and x.correct is not null
      order by x.revision desc limit 1) latest on true
    left join lateral (select x.correct,x.action from public.learning_vocab_cue_actions x
      where cp.config->'timetable'->'required_pairs' @> jsonb_build_array(c.idx*3+m.offset_id)
        and x.assignment_id=a.id and x.pair=c.idx*3+m.offset_id and x.phase in ('diagnostic','check','review')
        and x.recorded_at<(cp.config->'timetable'->>'focus_due_at')::timestamptz
      order by (x.correct is not null) desc,x.revision desc limit 1) before_deadline on true
    where cp.config->'modes' ? m.mode
  ) cue on true
  left join lateral (
    select ha.id,x.correct
    from public.learning_vocab_drafts d
    join public.learning_vocab_approvals v on v.draft_id=d.id and v.academy_id=p.academy_id
    join public.learning_vocab_cue_plans h on h.lesson_id=v.lesson_id
    join public.learning_path_plans hp on hp.lesson_id=h.lesson_id and hp.class_id=p.class_id
    join public.solo_assignments ha on ha.lesson_id=h.lesson_id and ha.student_id=a.student_id and ha.kind='homework'
    cross join lateral (select (ordinality-1)::int idx from jsonb_array_elements(hp.cards) with ordinality
      where value->>'word'=c.card->>'word' and value->>'meaning'=c.card->>'meaning') hc
    left join public.learning_vocab_cue_actions x on x.assignment_id=ha.id and x.phase='context' and x.pair=hc.idx*3
    where d.source_lesson=p.lesson_id and d.kind='homework'
    order by v.approved_at desc,v.request_id limit 1
  ) hw on true
  where p.lesson_id=p_lesson
$$;

create or replace function public.learning_vocab_cue_feedback(p_class uuid,p_lesson uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare base jsonb; timetable jsonb;
begin
  base:=public.learning_vocab_feedback(p_class,p_lesson);
  select config->'timetable' into timetable from public.learning_vocab_cue_plans where lesson_id=p_lesson;
  return base||jsonb_build_object('cue_ready',has_function_privilege('authenticated',
      'public.learning_vocab_cue_approve(uuid,uuid,uuid[],text,jsonb,text[],boolean,uuid,timestamptz,jsonb,boolean)','EXECUTE'),
    'timetable',case when timetable is not null then timetable||jsonb_build_object('deadline_passed',
      coalesce((timetable->>'focus_due_at')::timestamptz<=now(),false)) end,
    'cue_lesson',exists(
      select 1 from public.learning_vocab_cue_plans where lesson_id=p_lesson
    ),'cue_rows',coalesce((
      select jsonb_agg(to_jsonb(r) order by r.goal_index,r.student_name,r.student_id) from public.learning_vocab_cue_rows(p_lesson) r
    ),'[]'::jsonb));
end$$;

create or replace function public.learning_vocab_cue_draft(p_source uuid,p_kind text,p_student uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy(); source public.learning_path_plans; source_name text;
  proposal jsonb; draft uuid; cards jsonb; students jsonb; modes text[]; needs_practice boolean; contexts jsonb; essential_goals jsonb;
begin
  if p_kind is null or p_kind not in ('lesson','homework') then raise exception 'bad_kind'; end if;
  if not public.academy_feature(ac,'solo') or (p_kind='homework' and not public.academy_feature(ac,'homework'))
    then raise exception 'feature_closed'; end if;
  select * into source from public.learning_path_plans p where p.lesson_id=p_source and p.academy_id=ac
    and not exists(select 1 from public.learning_homework_plans h where h.lesson_id=p.lesson_id);
  if not found then raise exception 'not_found'; end if;
  if not exists(select 1 from public.learning_vocab_cue_plans where lesson_id=p_source) then
    return public.learning_vocab_draft(p_source,p_kind,p_student);
  end if;
  select name into source_name from public.solo_lessons where id=p_source;
  with observed as materialized (
    select * from public.learning_vocab_cue_rows(p_source)
    where p_student is null or student_id=p_student
  ), needs as (
    select student_id,goal_index,card,mode.key as mode,(mode.value->'latest'='false'::jsonb) as struggling,
      coalesce(mode.value->'essential'='true'::jsonb,false) as essential
    from observed
      cross join lateral jsonb_each(cues) mode
      where (ready or mode.value->'essential'='true'::jsonb) and (mode.value->'latest'='false'::jsonb
        or (mode.value->'essential'='true'::jsonb and mode.value->'latest'='null'::jsonb and mode.value->'unavailable'='true'::jsonb))
    union
    select student_id,goal_index,card,'context_support',true,false from observed where context_correct=false
  ), candidates as (
    select student_id,goal_index,card,mode,struggling,essential from needs where p_kind='lesson'
    union all
    select o.student_id,o.goal_index,o.card,'context',
      exists(select 1 from needs n where n.student_id=o.student_id and n.goal_index=o.goal_index and n.struggling),
      exists(select 1 from needs n where n.student_id=o.student_id and n.goal_index=o.goal_index and n.essential)
    from observed o where p_kind='homework' and o.ready and (o.context_id is null or o.context_correct=false)
      and exists(select 1 from jsonb_each(o.cues) x where jsonb_typeof(x.value->'latest')='boolean')
  ), ranked as (
    select goal_index,card,mode,count(*) filter(where struggling) as need,count(*) filter(where essential) as required
    from candidates group by goal_index,card,mode
    order by required desc,need desc,goal_index,mode
  ), chosen as (
    select * from ranked where mode=(select mode from ranked limit 1)
    order by required desc,need desc,goal_index limit case when p_student is null then 1 when p_kind='homework' then 8 else 12 end
  )
  select (select jsonb_agg(card order by required desc,need desc,goal_index) from chosen),
    (select jsonb_agg(distinct c.student_id) from candidates c join chosen x using(goal_index,mode)),
    (select array_agg(distinct mode) from chosen),exists(select 1 from chosen where need>0),
    (select coalesce(jsonb_agg(jsonb_build_object('word',card->>'word','meaning',card->>'meaning','mode',mode)),'[]')
      from chosen where required>0 and p_kind='lesson')
  into cards,students,modes,needs_practice,essential_goals;
  if cards is null then return null; end if;
  if p_kind='homework' then
    select jsonb_agg(jsonb_build_object('word',card->>'word','meaning',card->>'meaning','sentence',coalesce(candidate.sentence,'')) order by ord)
      into contexts
    from jsonb_array_elements(cards) with ordinality c(card,ord)
    left join lateral (
      select w.example_sentence as sentence from public.word_bank w
      where lower(w.word)=card->>'word' and btrim(w.meaning)=card->>'meaning'
        and length(btrim(w.example_sentence)) between 8 and 250 and w.example_sentence ~* ('\m'||(card->>'word')||'\M')
        and not exists(select 1 from jsonb_array_elements(source.cards) original
          where public.learning_vocab_cue_sentence_key(original->>'example')=public.learning_vocab_cue_sentence_key(w.example_sentence))
        and not exists(select 1 from public.learning_path_plans p cross join lateral jsonb_array_elements(p.cards) old_card
          where p.academy_id=ac and public.learning_vocab_cue_sentence_key(old_card->>'example')=public.learning_vocab_cue_sentence_key(w.example_sentence)
            and exists(select 1 from public.solo_assignments a where a.lesson_id=p.lesson_id and students ? a.student_id::text))
        and not exists(select 1 from public.learning_vocab_cue_plans cp join public.learning_path_plans p on p.lesson_id=cp.lesson_id
          cross join lateral jsonb_array_elements(case when jsonb_typeof(cp.config->'contexts')='array' then cp.config->'contexts' else '[]'::jsonb end) old
          where p.academy_id=ac and public.learning_vocab_cue_sentence_key(old->>'sentence')=public.learning_vocab_cue_sentence_key(w.example_sentence)
            and exists(select 1 from public.solo_assignments a where a.lesson_id=p.lesson_id and students ? a.student_id::text))
      order by w.sense_number,w.example_sentence limit 1
    ) candidate on true;
  end if;
  proposal:=jsonb_build_object('title',left(source_name,82)||case when p_kind='homework' then ' · 새 문장 확인' else ' · 어휘 단서 보충' end,
    'cards',cards,'students',students,'reason',case when needs_practice then 'practice' else 'check' end,
    'games',p_kind='lesson','cue',jsonb_build_object('modes',case when p_kind<>'lesson' then '[]'::jsonb
      when 'context_support'=any(modes) then '["read"]'::jsonb else to_jsonb(modes) end,
      'contextual','context_support'=any(modes),'contexts',contexts,'essential',essential_goals));
  insert into public.learning_vocab_drafts(source_lesson,kind,student_id,proposal,created_by)
    values(p_source,p_kind,p_student,proposal,auth.uid()) returning id into draft;
  return proposal||jsonb_build_object('id',draft,'kind',p_kind);
end$$;

-- Decorate the already-authorized portal list before a scheduled plan is first opened.
create or replace function public.student_home_with_vocab_schedule(p_token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; lessons jsonb;
begin
  result:=public.student_home(p_token);
  if result ? 'error' or jsonb_typeof(result->'lessons') is distinct from 'array' then return result; end if;
  select coalesce(jsonb_agg(x.entry||case when (cp.config->'timetable'->>'starts_at')::timestamptz>now()
    then jsonb_build_object('path_waiting',true,'path_due_at',cp.config->'timetable'->'starts_at',
      'path_starts_at',cp.config->'timetable'->'starts_at') else '{}'::jsonb end order by x.ord),'[]')
  into lessons
  from jsonb_array_elements(result->'lessons') with ordinality x(entry,ord)
  left join public.solo_assignments a on a.id=(x.entry->>'id')::uuid
  left join public.learning_vocab_cue_plans cp on cp.lesson_id=a.lesson_id;
  return result||jsonb_build_object('lessons',lessons);
end$$;

revoke all on function public.learning_vocab_cue_sentence_key(text),public.learning_vocab_cue_guard_approval(),
  public.learning_vocab_next_day(int[],date),public.learning_vocab_schedule_read(uuid),public.learning_vocab_schedule_save(uuid,int,int[],int[]),
  public.learning_vocab_freeze_timetable(uuid,jsonb,jsonb,text[],boolean,timestamptz),
  public.learning_vocab_cue_guard_legacy(),public.learning_vocab_cue_index_run(),public.learning_vocab_cue_choices(jsonb,jsonb,boolean),
  public.learning_vocab_cue_items(jsonb,text[],boolean,jsonb,boolean),
  public.learning_vocab_cue_frozen(uuid),public.learning_vocab_cue_payload(uuid),public.learning_vocab_cue_rows(uuid),
  public.learning_vocab_cue_timetable(uuid),public.learning_vocab_cue_support(uuid,int,jsonb,jsonb,boolean),
  public.learning_vocab_cue_approve_plan(uuid,uuid,uuid[],text,jsonb,text[],boolean,uuid,timestamptz,jsonb,boolean,jsonb),
  public.learning_vocab_cue_approve_scheduled(uuid,uuid,uuid[],text,jsonb,text[],boolean,uuid,timestamptz,jsonb,boolean,jsonb),
  public.learning_vocab_cue_open(uuid,uuid),public.learning_vocab_cue_action(uuid,uuid,uuid,int,text,text),
  public.learning_vocab_cue_approve(uuid,uuid,uuid[],text,jsonb,text[],boolean,uuid,timestamptz,jsonb,boolean),
  public.learning_vocab_cue_feedback(uuid,uuid),public.learning_vocab_cue_draft(uuid,text,uuid),public.student_home_with_vocab_schedule(uuid)
  from public,anon,authenticated;
grant execute on function public.learning_vocab_cue_open(uuid,uuid),public.learning_vocab_cue_action(uuid,uuid,uuid,int,text,text),
  public.student_home_with_vocab_schedule(uuid) to anon,authenticated;
grant execute on function public.learning_vocab_cue_approve(uuid,uuid,uuid[],text,jsonb,text[],boolean,uuid,timestamptz,jsonb,boolean),
  public.learning_vocab_cue_approve_scheduled(uuid,uuid,uuid[],text,jsonb,text[],boolean,uuid,timestamptz,jsonb,boolean,jsonb),
  public.learning_vocab_schedule_read(uuid),public.learning_vocab_schedule_save(uuid,int,int[],int[]),
  public.learning_vocab_cue_feedback(uuid,uuid),public.learning_vocab_cue_draft(uuid,text,uuid) to authenticated;

commit;
