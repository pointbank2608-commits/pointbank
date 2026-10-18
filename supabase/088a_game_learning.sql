-- 088a: 게임 뒤 짧은 학습 확인. 선행: 041, 047~069, 074.
-- 게임 점수는 받지 않는다. 서버가 고정한 문제를 채점해 기존 learning_events에 기록한다.
begin;
create table if not exists public.solo_game_checks (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.solo_assignments(id) on delete cascade,
  step_index int not null check(step_index >= 0),
  template_id uuid not null,
  questions jsonb not null default '[]'::jsonb,
  responses jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(assignment_id,step_index)
);
alter table public.solo_game_checks enable row level security;
revoke all on public.solo_game_checks from public,anon,authenticated;
alter table public.learning_events add column if not exists solo_assignment_id uuid references public.solo_assignments(id) on delete cascade;
create index if not exists learning_events_solo_assignment_idx on public.learning_events(solo_assignment_id);

-- 공개 문제에는 정답/자료 스냅샷을 보내지 않는다. 듣기 TTS의 word는 기존 듣기 단계와 같다.
create or replace function public.solo_game_check_state(p_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('id',c.id,'questions',coalesce((
    select jsonb_agg(public.solo_public_step(q - '_card' - 'skill') order by n)
    from jsonb_array_elements(c.questions) with ordinality as x(q,n)), '[]'::jsonb),
    'responses',c.responses) from public.solo_game_checks c where c.id=p_id
$$;

create or replace function public.solo_game_check_open(p_token uuid,p_assignment uuid,p_step int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  a public.solo_assignments; s jsonb; tpl public.game_templates; c public.solo_game_checks;
  cards jsonb; card jsonb; q jsonb; qs jsonb := '[]'; opts jsonb; answer_n int; w text; m text;
begin
  a := public.solo_assignment_for(p_token,p_assignment);
  select steps->p_step into s from public.solo_lessons where id=a.lesson_id;
  if p_step is null or p_step < 0 or s->>'t' is distinct from 'game' then raise exception 'not_found'; end if;
  if s->>'measure' = 'false' then return jsonb_build_object('disabled',true); end if;
  select * into c from public.solo_game_checks where assignment_id=a.id and step_index=p_step;
  if c.id is not null then return public.solo_game_check_state(c.id); end if;
  select * into tpl from public.game_templates where id=(s->>'templateId')::uuid;
  if tpl.id is null or tpl.academy_id is distinct from a.academy_id
    or (tpl.class_id is not null and tpl.class_id is distinct from (select class_id from public.students where id=a.student_id))
    or tpl.game_type is distinct from s->>'gameType'
    or tpl.game_type not in ('matchup','anagram','hangman','wordsearch','whackamole') then raise exception 'not_found'; end if;
  -- 출처 카드가 있으면 뜻/철자를 확인한다. 전용 짝 게임은 실제 게임의 짝을 우선한다.
  if tpl.game_type in ('matchup','whackamole') then
    select coalesce(jsonb_agg(jsonb_build_object('word',p->>'left','meaning',p->>'right')), '[]') into cards
      from jsonb_array_elements(coalesce(tpl.config->'pairs','[]')) p;
  elsif jsonb_typeof(tpl.config->'classroomSource'->'cards')='array' then
    select coalesce(jsonb_agg(v),'[]') into cards from jsonb_array_elements(tpl.config->'classroomSource'->'cards') v
      where exists(select 1 from jsonb_array_elements(tpl.items) i where lower(btrim(i->>'label'))=lower(btrim(v->>'word')));
  else
    select coalesce(jsonb_agg(jsonb_build_object('word',p->>'label','meaning','')), '[]') into cards from jsonb_array_elements(tpl.items) p;
  end if;
  -- 같은 낱말/뜻은 보기에 중복하지 않는다. 어휘 게임이므로 문장 전체는 측정하지 않는다.
  select coalesce(jsonb_agg(v), '[]') into cards from (
    select distinct on (lower(btrim(v->>'word'))) v from jsonb_array_elements(cards) v
    where length(btrim(v->>'word')) between 1 and 80 and btrim(v->>'word') ~ '^[a-zA-Z][a-zA-Z ''-]*$'
      and cardinality(regexp_split_to_array(btrim(v->>'word'),'\s+')) <= 3
    order by lower(btrim(v->>'word'))
  ) x;
  for card in select v from jsonb_array_elements(cards) v order by random() limit 4 loop
    w := btrim(card->>'word'); m := btrim(coalesce(card->>'meaning',''));
    if tpl.game_type in ('matchup','whackamole') and m<>'' then
      select jsonb_agg(to_jsonb(val) order by r) into opts from (
        select val,random() r from (select distinct btrim(v->>'meaning') val from jsonb_array_elements(cards) v where btrim(coalesce(v->>'meaning',''))<>'') d
        order by (val=m) desc, random() limit 4
      ) choices;
      if jsonb_array_length(opts)<2 then continue; end if;
      select n::int-1 into answer_n from jsonb_array_elements_text(opts) with ordinality x(val,n) where val=m;
      q := jsonb_build_object('t','pickMeaning','word',w,'imageUrl',null,'options',opts,'answer',answer_n,'skill','vocab.meaning');
    elsif m<>'' then
      q := jsonb_build_object('t','typeWord','word',w,'meaning',m,'imageUrl',null,'length',length(w),'first','','skill','vocab.spelling');
    else
      q := jsonb_build_object('t','dictation','word',w,'length',length(w),'skill','listening.dictation');
    end if;
    qs := qs || jsonb_build_array(q || jsonb_build_object('_card',card));
  end loop;
  insert into public.solo_game_checks(assignment_id,step_index,template_id,questions)
    values(a.id,p_step,tpl.id,qs) on conflict(assignment_id,step_index) do nothing;
  select * into c from public.solo_game_checks where assignment_id=a.id and step_index=p_step;
  return public.solo_game_check_state(c.id);
end $$;

create or replace function public.solo_game_check_answer(p_token uuid,p_assignment uuid,p_step int,p_question int,p_value text,p_request uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  a public.solo_assignments; c public.solo_game_checks; q jsonb; r jsonb; ok boolean; event_kind text;
  existing public.learning_events; w text; sk text; today timestamptz;
begin
  a := public.solo_assignment_for(p_token,p_assignment);
  select * into c from public.solo_game_checks where assignment_id=a.id and step_index=p_step for update;
  if c.id is null or p_request is null or p_question is null or p_question<0 or p_question>=jsonb_array_length(c.questions)
     or p_value is null or length(p_value)>300 then raise exception 'bad_answer'; end if;
  q:=c.questions->p_question; w:=lower(btrim(q->>'word')); sk:=q->>'skill';
  -- 재전송은 같은 결과를 반환한다. 다른 문제/학생의 요청 ID는 재사용할 수 없다.
  select * into existing from public.learning_events where client_id=p_request;
  if existing.id is not null then
    if existing.solo_assignment_id is distinct from a.id or existing.q_index is distinct from p_question
       or existing.meta->>'check_id' is distinct from c.id::text then raise exception 'bad_request'; end if;
    return jsonb_build_object('correct',existing.correct,'answer',public.solo_correct_text(q),'first',c.responses->p_question::text->'correct');
  end if;
  r:=c.responses->p_question::text;
  if coalesce((r->>'attempts')::int,0)>=2 then
    return jsonb_build_object('correct',(r->>'last_correct')::boolean,'answer',public.solo_correct_text(q),'first',r->'correct');
  end if;
  ok:=coalesce(public.solo_grade(q,p_value),false);
  today:=date_trunc('day',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  perform pg_advisory_xact_lock(hashtext(a.student_id::text||':'||w||':'||sk));
  event_kind:=case when r is not null or exists(
    select 1 from public.learning_events e where e.student_id=a.student_id and e.event_type='answer'
      and e.meta->>'source'='solo_game' and lower(btrim(e.word))=w and e.skill=sk and e.created_at>=today
  ) then 'retry_answer' else 'answer' end;
  insert into public.learning_events(academy_id,student_id,solo_assignment_id,q_index,event_type,skill,word,content_id,difficulty,correct,response,meta,client_id)
    values(a.academy_id,a.student_id,a.id,p_question,event_kind,sk,w,'word:'||w,case when q->>'t'='pickMeaning' then 1 else 2 end,ok,p_value,
      (q->'_card')||jsonb_build_object('source','solo_game','check_id',c.id,'step',p_step,'question_type',q->>'t'),p_request);
  r:=jsonb_build_object('correct',coalesce(r->'correct',to_jsonb(ok)),'last_correct',ok,'attempts',coalesce((r->>'attempts')::int,0)+1,'answer',public.solo_correct_text(q));
  update public.solo_game_checks set responses=jsonb_set(responses,array[p_question::text],r) where id=c.id;
  -- 계속 어려워하면 기존 선생님 현황의 도움 요청에 표시한다.
  if (select count(*) from jsonb_each((select responses from public.solo_game_checks where id=c.id)) x where x.value->>'correct'='false')>=2 then
    update public.solo_assignments set help_at=coalesce(help_at,now()),help_step=p_step where id=a.id;
  end if;
  return jsonb_build_object('correct',ok,'answer',public.solo_correct_text(q),'first',r->'correct');
end $$;

revoke all on function public.solo_game_check_state(uuid) from public,anon,authenticated;
revoke all on function public.solo_game_check_open(uuid,uuid,int) from public,anon,authenticated;
revoke all on function public.solo_game_check_answer(uuid,uuid,int,int,text,uuid) from public,anon,authenticated;
grant execute on function public.solo_game_check_open(uuid,uuid,int), public.solo_game_check_answer(uuid,uuid,int,int,text,uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
