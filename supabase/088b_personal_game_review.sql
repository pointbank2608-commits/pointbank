-- 088b: 숙제·개별수업·게임 확인 기록을 추천/다음 수업 복습으로 연결. 088a 다음에 실행.
begin;
-- 복원용 기존 함수는 최초 실행 때만 보관한다.
do $$ begin
  if to_regprocedure('public.solo_word_stats_before_games(uuid,uuid)') is null then
    alter function public.solo_word_stats(uuid,uuid) rename to solo_word_stats_before_games;
  end if;
  if to_regprocedure('public.student_review_candidates_before_games(uuid)') is null then
    alter function public.student_review_candidates(uuid) rename to student_review_candidates_before_games;
  end if;
  if to_regprocedure('public.solo_open_before_game_learning(uuid,uuid)') is null then
    alter function public.solo_open(uuid,uuid) rename to solo_open_before_game_learning;
  end if;
  if to_regprocedure('public.solo_start_review_before_games(uuid,text,int,jsonb)') is null then
    alter function public.solo_start_review(uuid,text,int,jsonb) rename to solo_start_review_before_games;
  end if;
  if to_regprocedure('public.student_skill_events_before_games(uuid,timestamptz)') is null then
    alter function public.student_skill_events(uuid,timestamptz) rename to student_skill_events_before_games;
  end if;
end $$;

create or replace function public.solo_open(p_token uuid,p_assignment uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.solo_assignments; result jsonb;
begin
  a:=public.solo_assignment_for(p_token,p_assignment);
  result:=public.solo_open_before_game_learning(p_token,p_assignment);
  return result||jsonb_build_object('personal_review',(select coalesce(source='review',false) from public.solo_lessons where id=a.lesson_id));
end $$;

create or replace function public.student_game_growth(p_student uuid,p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare academy uuid:=public.hw_staff_academy(); since timestamptz:=now()-make_interval(days=>case when p_days=90 then 90 else 30 end);
begin
  if not exists(select 1 from public.students where id=p_student and academy_id=academy) then raise exception 'not_found'; end if;
  return (with ev as (select * from public.learning_events where student_id=p_student and (meta->>'source'='solo_game' or meta->>'item_kind'='game') and event_type='answer'),
    good as (select * from ev where correct and created_at>=since)
    select jsonb_build_object('checked',count(distinct word),'measured',(select count(*) from ev where created_at>=since),
      'remembered',count(distinct word) filter(where exists(select 1 from ev old where old.word=good.word and old.skill=good.skill and old.correct and old.created_at<=good.created_at-interval '1 day')),
      'transferred',(select count(*) from (select word from good group by word having count(distinct skill)>1) x)) from good);
end $$;

create or replace function public.student_learning_history(p_student uuid)
returns table(skill text,correct boolean,created_at timestamptz,word text,card jsonb,src text)
language sql stable security definer set search_path=public as $$
  with cards as materialized (
    select distinct on (public.solo_step_word(s)) public.solo_step_word(s) word,
      jsonb_build_object('word',public.solo_step_word(s),'meaning',s->>'meaning','imageUrl',s->>'imageUrl','example',s->>'example') card
    from public.solo_assignments a join public.solo_lessons l on l.id=a.lesson_id,jsonb_array_elements(l.steps) s
    where a.student_id=p_student and public.solo_step_word(s) is not null and coalesce(s->>'meaning','')<>''
    order by public.solo_step_word(s),(s->>'t'='meet') desc,a.assigned_at desc
  )
  select e.skill,e.correct,e.created_at,lower(btrim(e.word)),e.meta,
    case when e.meta->>'source'='solo_game' then 'solo_game' else 'homework' end
  from public.learning_events e where e.student_id=p_student and e.event_type in ('answer','retry_answer')
    and e.skill is not null and e.correct is not null and coalesce(btrim(e.word),'')<>''
  union all
  select f.skill,f.ok,f.created_at,lower(btrim(f.word)),c.card, 'solo'
  from public.solo_first_answers(p_student,now()-interval '90 days') f
  left join cards c on c.word=lower(btrim(f.word))
  where f.skill is not null and f.ok is not null and coalesce(btrim(f.word),'')<>''
$$;

-- 교사 수업 현황의 정답/오답에도 게임 확인 결과를 더할 수 있게 한다(게임 점수는 제외).
create or replace function public.solo_game_results(p_lesson uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare academy uuid:=public.hw_staff_academy();
begin
  if not exists(select 1 from public.solo_lessons where id=p_lesson and academy_id=academy) then raise exception 'not_found'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select c.assignment_id,count(*) filter(where r.value->>'correct'='true') right_count,count(*) filter(where r.value->>'correct'='false') wrong_count,
      coalesce(jsonb_agg(distinct c.questions->(r.key::int)->>'word') filter(where r.value->>'correct'='false'),'[]') missed_words
    from public.solo_game_checks c join public.solo_assignments a on a.id=c.assignment_id,
      jsonb_each(c.responses) r where a.lesson_id=p_lesson group by c.assignment_id
  ) x),'[]');
end $$;

create or replace function public.student_review_candidates(p_student_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_academy uuid:=public.hw_staff_academy();
begin
  if not exists(select 1 from public.students where id=p_student_id and academy_id=v_academy) then raise exception 'not_found'; end if;
  return jsonb_build_object(
    'graded',(select count(*) from public.student_skill_events(p_student_id,now()-interval '90 days')),
    'completed_activities',(select count(*) from public.homework_item_attempts x join public.homework_attempts a on a.id=x.attempt_id where a.student_id=p_student_id and x.finished_at>now()-interval '90 days')
      +(select count(*) from public.solo_assignments where student_id=p_student_id and finished_at>now()-interval '90 days'),
    'words',coalesce((with history as materialized (
      select * from public.student_learning_history(p_student_id) where created_at>now()-interval '90 days'
    ), grouped as (
      select word,skill,count(*) filter(where not correct) wrong,count(*) filter(where correct) right_n,
        max(created_at) filter(where not correct) last_wrong,max(created_at) filter(where correct) last_right,max(created_at) last_seen
      from history group by word,skill
    ) select jsonb_agg(w order by w->>'last_seen' desc) from (
      select jsonb_build_object('word',g.word,'card',(select card from history h where h.word=g.word and coalesce(card->>'meaning','')<>'' order by h.created_at desc limit 1),
        'last_seen',max(g.last_seen),'skills',jsonb_object_agg(g.skill,jsonb_build_object('wrong',g.wrong,'right',g.right_n,'last_wrong',g.last_wrong,'last_right',g.last_right))) w
      from grouped g group by g.word
    ) x),'[]'::jsonb));
end $$;

-- 기존 개별수업 낱말 정보에 숙제/게임 확인 기록을 더한다. 기존 집계는 한 번만 센다.
create or replace function public.solo_word_stats(p_student uuid,p_assignment uuid default null)
returns table(word text,meaning text,image_url text,example text,pos text,right_n bigint,wrong_n bigint,unsure_n bigint,last_at timestamptz,is_recent boolean,missed_here boolean)
language sql stable security definer set search_path=public as $$
  with old as (select * from public.solo_word_stats_before_games(p_student,p_assignment)),
  ev as (
    select lower(btrim(e.word)) word,count(*) filter(where e.correct) rn,count(*) filter(where not e.correct) wn,
      max(e.created_at) last_at,bool_or(e.created_at>=now()-interval '2 days') recent,
      coalesce(bool_or(e.solo_assignment_id=p_assignment and not e.correct),false) missed
    from public.learning_events e where e.student_id=p_student and e.event_type in ('answer','retry_answer')
      and e.correct is not null and coalesce(btrim(e.word),'')<>'' group by lower(btrim(e.word))
  ), cards as (
    select distinct on (lower(btrim(e.word))) lower(btrim(e.word)) word,e.meta card
    from public.learning_events e where e.student_id=p_student and coalesce(e.meta->>'meaning','')<>''
    order by lower(btrim(e.word)),e.created_at desc,e.id desc
  )
  select coalesce(o.word,e.word),coalesce(nullif(o.meaning,''),c.card->>'meaning'),coalesce(o.image_url,c.card->>'imageUrl'),
    coalesce(o.example,c.card->>'example'),o.pos,coalesce(o.right_n,0)+coalesce(e.rn,0),coalesce(o.wrong_n,0)+coalesce(e.wn,0),coalesce(o.unsure_n,0),
    greatest(o.last_at,e.last_at),coalesce(o.is_recent,false) or coalesce(e.recent,false),coalesce(o.missed_here,false) or coalesce(e.missed,false)
  from old o full join ev e on lower(btrim(o.word))=e.word left join cards c on c.word=coalesce(lower(btrim(o.word)),e.word)
  where coalesce(nullif(o.meaning,''),c.card->>'meaning','')<>''
$$;

-- 원본 능력 계산 규칙 유지. 게임 확인도 숙제가 아닌 개별 학습 출처로 표시한다.
create or replace function public.student_skill_events(p_student uuid,p_since timestamptz)
returns table(skill text,correct boolean,created_at timestamptz,word text,src text)
language sql stable security definer set search_path=public as $$
  select e.skill,e.correct,e.created_at,e.word,case when e.meta->>'source'='solo_game' then 'solo' else 'homework' end
  from public.learning_events e where e.student_id=p_student and e.event_type='answer' and e.correct is not null and e.skill is not null and e.created_at>=p_since
  union all
  select f.skill,f.ok,f.created_at,f.word,'solo' from public.solo_first_answers(p_student,p_since) f
  where not f.retry and (f.is_test or f.attempt_no=1) and f.skill is not null and f.ok is not null
$$;

-- 기존 '어제 복습/다시 배우기'도 숙제에서 만난 낱말을 받아들인다.
create or replace function public.solo_start_review(p_token uuid,p_name text,p_minutes int,p_steps jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare sid uuid; st public.students; lid uuid; aid uuid;
begin
  sid:=public.student_session_student(p_token);
  select * into st from public.students where id=sid;
  if st.id is null then raise exception 'not_found'; end if;
  if not public.academy_feature(st.academy_id,'solo') then raise exception 'feature_closed'; end if;
  if p_steps is null or jsonb_typeof(p_steps)<>'array' or jsonb_array_length(p_steps)<2 or jsonb_array_length(p_steps)>80 then raise exception 'bad_steps'; end if;
  if exists(select 1 from jsonb_array_elements(p_steps) s where coalesce(s->>'t','') not in ('intro','meet','pickMeaning','pickWord','listenPick','spell')) then raise exception 'bad_steps'; end if;
  if exists(select 1 from jsonb_array_elements(p_steps) s where s->>'t'<>'intro' and not exists(
    select 1 from public.solo_word_stats(sid) w where w.word=public.solo_step_word(s))) then raise exception 'bad_words'; end if;
  if (select count(*) from public.solo_assignments where student_id=sid and kind='review' and assigned_at>now()-interval '1 day')>=30 then raise exception 'too_many'; end if;
  -- 진행 중인 다른 복습은 지우지 않는다. 원래 수업으로 돌아오는 연결도 보존한다.
  insert into public.solo_lessons(academy_id,class_id,name,level,minutes,steps,source,created_by)
    values(st.academy_id,st.class_id,left(coalesce(nullif(btrim(p_name),''),'복습'),60),null,greatest(1,least(coalesce(p_minutes,5),30)),p_steps,'review',null) returning id into lid;
  insert into public.solo_assignments(academy_id,lesson_id,student_id,kind,started_at)
    values(st.academy_id,lid,sid,'review',now()) returning id into aid;
  return jsonb_build_object('assignment',aid);
end $$;

-- 1일/다음 수업당 준비 연습 하나. 새로고침/중복 탭으로 과제를 계속 만들지 않는다.
create table if not exists public.solo_personal_starts(
  student_id uuid not null references public.students(id) on delete cascade,
  before_key text not null,
  day date not null,
  review_assignment uuid not null references public.solo_assignments(id) on delete cascade,
  primary key(student_id,before_key,day)
);
alter table public.solo_personal_starts enable row level security;
revoke all on public.solo_personal_starts from public,anon,authenticated;

create or replace function public.solo_start_personal_game(p_token uuid,p_before uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  sid uuid; st public.students; a public.solo_assignments; r record; sk text; qs jsonb;
  steps jsonb:=jsonb_build_array(jsonb_build_object('t','intro','title','오늘의 맞춤 연습','text','지난 숙제와 수업에서 만난 낱말로 짧게 시작해요.'));
  opts jsonb; ans int; lid uuid; aid uuid; key text:=coalesce(p_before::text,'home'); day_key date:=(now() at time zone 'Asia/Seoul')::date;
begin
  sid:=public.student_session_student(p_token);
  select * into st from public.students where id=sid;
  if st.id is null then raise exception 'not_found'; end if;
  if not public.academy_feature(st.academy_id,'solo') then raise exception 'feature_closed'; end if;
  if p_before is not null then a:=public.solo_assignment_for(p_token,p_before); end if;
  perform pg_advisory_xact_lock(hashtext(sid::text||':personal:'||key));
  select review_assignment into aid from public.solo_personal_starts where student_id=sid and before_key=key and day=day_key;
  if aid is not null then return jsonb_build_object('assignment',aid,'existing',true); end if;
  if (select count(*) from public.solo_assignments where student_id=sid and kind='review' and assigned_at>now()-interval '1 day')>=30 then raise exception 'too_many'; end if;
  for r in select * from public.solo_word_stats(sid) where meaning<>''
    order by (wrong_n+unsure_n>right_n) desc,(wrong_n+unsure_n) desc,last_at nulls first limit 6 loop
    select h.skill into sk from public.student_learning_history(sid) h where h.word=r.word and not h.correct
      order by h.created_at desc limit 1;
    if sk in ('vocab.spelling','listening.dictation') and r.word ~ '^[a-z][a-z ''-]{1,20}$' then
      qs:=case when sk='listening.dictation' then jsonb_build_object('t','dictation','word',r.word,'length',length(r.word))
        else jsonb_build_object('t','typeWord','word',r.word,'meaning',r.meaning,'imageUrl',null,'length',length(r.word),'first','') end;
    elsif sk like 'listening.%' then
      select jsonb_agg(to_jsonb(word) order by rand) into opts from (
        select word,random() rand from public.solo_word_stats(sid) order by (word=r.word) desc,random() limit 4
      ) x;
      if jsonb_array_length(opts)<2 then continue; end if;
      select n::int-1 into ans from jsonb_array_elements_text(opts) with ordinality x(w,n) where w=r.word;
      qs:=jsonb_build_object('t','listenPick','word',r.word,'options',opts,'images',(select jsonb_agg('null'::jsonb) from jsonb_array_elements(opts)),'answer',ans);
    else
      select jsonb_agg(to_jsonb(meaning) order by rand) into opts from (
        select meaning,random() rand from (select distinct meaning from public.solo_word_stats(sid) where meaning<>'') d
        order by (meaning=r.meaning) desc,random() limit 4
      ) x;
      if jsonb_array_length(opts)<2 then continue; end if;
      select n::int-1 into ans from jsonb_array_elements_text(opts) with ordinality x(w,n) where w=r.meaning;
      qs:=jsonb_build_object('t','pickMeaning','word',r.word,'imageUrl',null,'options',opts,'answer',ans);
    end if;
    steps:=steps||jsonb_build_array(qs);
  end loop;
  if jsonb_array_length(steps)<3 then return jsonb_build_object('empty',true); end if;
  insert into public.solo_lessons(academy_id,class_id,name,minutes,steps,source,origin,created_by)
    values(st.academy_id,st.class_id,'오늘의 맞춤 연습',3,steps,'review','personal_game',null) returning id into lid;
  insert into public.solo_assignments(academy_id,lesson_id,student_id,kind,started_at)
    values(st.academy_id,lid,sid,'review',now()) returning id into aid;
  insert into public.solo_personal_starts values(sid,key,day_key,aid);
  return jsonb_build_object('assignment',aid);
end $$;

revoke all on function public.student_learning_history(uuid),public.solo_word_stats_before_games(uuid,uuid),public.solo_word_stats(uuid,uuid),public.student_skill_events(uuid,timestamptz),public.student_review_candidates_before_games(uuid) from public,anon,authenticated;
revoke all on function public.solo_start_review_before_games(uuid,text,int,jsonb),public.student_skill_events_before_games(uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.solo_start_review(uuid,text,int,jsonb) from public,anon,authenticated;
grant execute on function public.solo_start_review(uuid,text,int,jsonb) to anon,authenticated;
revoke all on function public.student_review_candidates(uuid) from public,anon;
grant execute on function public.student_review_candidates(uuid) to authenticated;
revoke all on function public.solo_start_personal_game(uuid,uuid) from public,anon,authenticated;
grant execute on function public.solo_start_personal_game(uuid,uuid) to anon,authenticated;
revoke all on function public.solo_open_before_game_learning(uuid,uuid) from public,anon,authenticated;
revoke all on function public.solo_open(uuid,uuid) from public,anon,authenticated;
grant execute on function public.solo_open(uuid,uuid) to anon,authenticated;
revoke all on function public.student_game_growth(uuid,int) from public,anon;
grant execute on function public.student_game_growth(uuid,int) to authenticated;
revoke all on function public.solo_game_results(uuid) from public,anon;
grant execute on function public.solo_game_results(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
