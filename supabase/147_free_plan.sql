begin;

-- The trial runs through the end of its last day in Korea.
create function public.academy_has_teaching_plan(p_academy uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.academies
    where id=p_academy and (plan='paid' or trial_ends_at >= (now() at time zone 'Asia/Seoul')::date))
$$;
revoke all on function public.academy_has_teaching_plan(uuid) from public, anon;
grant execute on function public.academy_has_teaching_plan(uuid) to authenticated, service_role;

create or replace function public.academy_feature(p_academy uuid,p_key text)
returns boolean language sql stable security definer set search_path='' as $$
  select public.academy_has_teaching_plan(p_academy) and
    coalesce((select (a.features->>p_key)::boolean from public.academies a where a.id=p_academy),p_key='group')
$$;

-- Keep trial and paid materials intact. The oldest word list that fits the free
-- allowance is usable after downgrade; if none fits, the teacher can create one.
create function public.free_word_list_id()
returns uuid language sql stable security definer set search_path='' as $$
  select id from public.word_lists where academy_id=public.my_academy_id()
    and kind='word' and jsonb_array_length(items)<=10
    order by created_at,id limit 1
$$;
revoke all on function public.free_word_list_id() from public,anon;
grant execute on function public.free_word_list_id() to authenticated;

create policy free_word_list_access on public.word_lists as restrictive for all to authenticated
using (public.is_platform_admin() or public.academy_has_teaching_plan(academy_id) or
  (academy_id=public.my_academy_id() and kind='word' and jsonb_array_length(items)<=10
    and id=coalesce((select public.free_word_list_id()),id)))
with check (public.is_platform_admin() or public.academy_has_teaching_plan(academy_id) or
  (academy_id=public.my_academy_id() and kind='word' and jsonb_array_length(items)<=10));

create or replace function public.check_free_wordlist_limit()
returns trigger language plpgsql security definer set search_path='' as $$
declare allowed_id uuid;
begin
  if public.academy_has_teaching_plan(new.academy_id) then return new; end if;
  perform 1 from public.academies where id=new.academy_id for update;
  if new.kind<>'word' or jsonb_array_length(new.items)>10 then
    raise exception '무료 플랜에서는 단어장 1개에 최대 10단어를 담을 수 있어요.';
  end if;
  select id into allowed_id from public.word_lists
    where academy_id=new.academy_id and kind='word' and jsonb_array_length(items)<=10
    order by created_at,id limit 1;
  if allowed_id is not null and (tg_op='INSERT' or new.id<>allowed_id) then
    raise exception '무료 플랜에서는 단어장 1개를 이용할 수 있어요.';
  end if;
  return new;
end $$;
drop trigger word_lists_free_cap on public.word_lists;
create trigger word_lists_free_cap before insert or update on public.word_lists
for each row execute function public.check_free_wordlist_limit();

create or replace function public.check_free_tier_limits()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not public.academy_has_teaching_plan(new.academy_id) then
    raise exception '학생 관리·출석부·포인트·숙제는 유료 플랜에서 이용할 수 있어요.';
  end if;
  return new;
end $$;
-- classes and students already use check_free_tier_limits for inserts.
create trigger teaching_plan_attendance before insert or update on public.attendance
for each row execute function public.check_free_tier_limits();
create trigger teaching_plan_points before insert or update on public.transactions
for each row execute function public.check_free_tier_limits();
create trigger teaching_plan_homework before insert or update on public.homework_assignments
for each row execute function public.check_free_tier_limits();
-- Free choices belong to the teacher rather than the academy.
create function public.valid_free_game_choices(choices text[]) returns boolean
language sql immutable set search_path='' as $$
  select cardinality(choices)<=3 and cardinality(choices)=(select count(distinct game) from unnest(choices) game)
    and choices <@ array['balloonpop','wordtrain','wordfishing','sentencerocket','grammardetective','treasurehunt','wordclaw','feedmonster','sentencebridge','sentencetower','telepathy','shufflefind','grammarlab','grammarverb','grammarauction','grammarwrite','grammarpos','grammarframe','grammarcompare','grammarlink','grammarhabit','grammarpassive','grammarcond','grammarrelative','grammarask','grammarshop','sentencesplash','order','bomb','timer','tictactoe','saveorgive','findmissing','baskin31','connect4','popcorn','passball','twodice','quiz','hangman','truefalse','matchup','wordhoops','tugofwar','whackamole','flashcards','anagram','groupsort','unscramble','typeanswer','spellword','rankorder','wordsearch','crossword','mathgen','mazechase','airplane','labeleddiagram','imagequiz','gameshowquiz','winlosequiz','watermelon','shopping','treasuredig','fourclues','catchsentence','lightning','lastbox','mysterybox','airport','restaurant','icecream','doctor']::text[]
$$;
alter table public.profiles add column free_game_choices text[] not null default '{}'
  check (public.valid_free_game_choices(free_game_choices) and (cardinality(free_game_choices)=0 or role in ('teacher','owner')));
create function public.save_free_game_choices(p_expected text[],p_choices text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.profiles set free_game_choices=p_choices
    where id=auth.uid() and role in ('owner','teacher') and free_game_choices=p_expected;
  if not found then raise exception '게임 선택이 변경됐어요. 현재 선택을 확인한 뒤 다시 저장해 주세요.'; end if;
end $$;
revoke all on function public.save_free_game_choices(text[],text[]) from public,anon;
grant execute on function public.save_free_game_choices(text[],text[]) to authenticated;

create function public.guard_free_game_template() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not public.academy_has_teaching_plan(new.academy_id) and new.game_type not in ('wheel','ladder')
     and not exists(select 1 from public.profiles where id=auth.uid() and academy_id=new.academy_id
       and role in ('owner','teacher') and new.game_type=any(free_game_choices)) then
    raise exception '이 게임은 무료 플랜에서 샘플 수업으로 이용할 수 있어요.';
  end if;
  return new;
end $$;
create trigger free_game_template_guard before insert or update on public.game_templates
for each row execute function public.guard_free_game_template();
create trigger teaching_plan_live_contest before insert on public.live_sessions
for each row execute function public.check_free_tier_limits();

-- Track three distinct games per teacher. The dialog acknowledges a specific cycle,
-- so repeat acknowledgements and reloads cannot dismiss a later recommendation.
create table public.free_game_usage (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  choices text[] not null default '{}', played text[] not null default '{}',
  last_visits jsonb not null default '{}', completed integer not null default 0,
  acknowledged integer not null default 0,
  prompt_hidden_on date
);
alter table public.free_game_usage enable row level security;
revoke all on public.free_game_usage from public,anon,authenticated;
grant select on public.free_game_usage to authenticated;
create policy read_own_game_usage on public.free_game_usage for select to authenticated using(teacher_id=auth.uid());

create function public.record_free_choice_play(p_game text,p_visit uuid) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); selected text[]; usage public.free_game_usage; played_now text[];
begin
  select array(select g from unnest(p.free_game_choices) g order by g) into selected
    from public.profiles p where p.id=uid and p.role in ('owner','teacher')
      and not public.academy_has_teaching_plan(p.academy_id) for share;
  if selected is null or cardinality(selected)<>3 or not(p_game=any(selected)) or p_visit is null then return; end if;
  insert into public.free_game_usage(teacher_id) values(uid) on conflict do nothing;
  select * into usage from public.free_game_usage where teacher_id=uid for update;
  if usage.last_visits->>p_game=p_visit::text then return; end if;
  played_now:=case when usage.choices=selected then usage.played else '{}'::text[] end;
  if not(p_game=any(played_now)) then played_now:=array_append(played_now,p_game); end if;
  update public.free_game_usage set choices=selected,
    played=case when cardinality(played_now)=3 then '{}'::text[] else played_now end,
    completed=completed+case when cardinality(played_now)=3 then 1 else 0 end,
    acknowledged=case when cardinality(played_now)=3 and prompt_hidden_on=(statement_timestamp() at time zone 'Asia/Seoul')::date
      then completed+1 else acknowledged end,
    last_visits=jsonb_set(last_visits,array[p_game],to_jsonb(p_visit::text))
    where teacher_id=uid;
end $$;
create function public.dismiss_free_upgrade_prompt(p_cycle integer) returns void
language sql security definer set search_path='' as $$
  update public.free_game_usage set acknowledged=p_cycle where teacher_id=auth.uid()
    and p_cycle=acknowledged+1 and p_cycle<=completed
$$;
revoke all on function public.record_free_choice_play(text,uuid),public.dismiss_free_upgrade_prompt(integer) from public,anon;
grant execute on function public.record_free_choice_play(text,uuid),public.dismiss_free_upgrade_prompt(integer) to authenticated;

create function public.hide_free_upgrade_prompt_today(p_cycle integer) returns void
language sql security definer set search_path='' as $$
  update public.free_game_usage
    set acknowledged=completed, prompt_hidden_on=(statement_timestamp() at time zone 'Asia/Seoul')::date
    where teacher_id=auth.uid() and p_cycle between acknowledged+1 and completed
$$;
revoke all on function public.hide_free_upgrade_prompt_today(integer) from public,anon;
grant execute on function public.hide_free_upgrade_prompt_today(integer) to authenticated;

commit;
