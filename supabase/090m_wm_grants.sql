-- 090m 권한: 표는 정책이 없어 직접 읽기·쓰기가 막혀 있고(RLS), 아래 함수로만 접근한다.
-- 학생 함수(개인 링크 열쇠 필요) = anon·authenticated, 선생님 함수 = authenticated(함수 안에서 직원·학원 확인), 내부 함수 = 아무도 직접 못 부른다.

revoke all on public.wm_plans, public.wm_targets, public.wm_words, public.wm_sessions, public.wm_answers from anon, authenticated;
revoke usage, select on sequence public.wm_answers_id_seq from anon, authenticated;
do $$
declare
  f text;
begin
  foreach f in array array[
    'wm_target_for(text)', 'wm_stage_counts(uuid)', 'wm_session_payload(uuid)', 'wm_build_session(uuid)', 'wm_review_item(uuid,text,jsonb,text)',
    'wm_new_item(uuid,text,jsonb)', 'wm_make_q(jsonb,text,jsonb)', 'wm_choice_q(text,text,text,text,text,text,text[],text)',
    'wm_distractors(jsonb,jsonb,text,int)', 'wm_apply_result(uuid,text,text,text,boolean,boolean,boolean)', 'wm_check_done(uuid)',
    'wm_first_q(jsonb,jsonb,text[])', 'wm_card(jsonb,text)', 'wm_clean_cards(jsonb)', 'wm_staff_academy()', 'wm_plan_for_staff(uuid)',
    'wm_shuffle(text[])', 'wm_pick_styles(public.wm_words,text,text[])', 'wm_grade(jsonb,text)', 'wm_answer_text(jsonb)', 'wm_mode_params(text)', 'wm_now()', 'wm_today()']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['wm_open(text)', 'wm_today_state(text)', 'wm_ack(text,uuid,int,uuid)', 'wm_hint(text,uuid,int)',
                           'wm_answer(text,uuid,int,text,uuid)', 'wm_collection(text)', 'wm_student_links(uuid)']
  loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
  foreach f in array array['wm_assign(uuid,uuid,text,jsonb,jsonb,uuid[],text,int,int)', 'wm_plan_list(uuid)', 'wm_plan_results(uuid)', 'wm_plan_links(uuid)', 'wm_plan_close(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
