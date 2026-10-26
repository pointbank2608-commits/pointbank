-- 090 되돌리기: 단어암기숙제의 표·함수만 지운다(기존 숙제·학습 기록·단어장에는 영향 없음). 학생의 단어암기 기록은 함께 사라진다 — 지우기 전에 필요하면 백업.
drop function if exists public.wm_student_links(uuid);
drop function if exists public.wm_plan_close(uuid), public.wm_plan_links(uuid), public.wm_plan_results(uuid), public.wm_plan_list(uuid), public.wm_plan_for_staff(uuid);
drop function if exists public.wm_collection(text), public.wm_answer(text, uuid, int, text, uuid), public.wm_hint(text, uuid, int), public.wm_ack(text, uuid, int, uuid);
drop function if exists public.wm_apply_result(uuid, text, text, text, boolean, boolean, boolean), public.wm_check_done(uuid);
drop function if exists public.wm_today_state(text), public.wm_open(text), public.wm_session_payload(uuid), public.wm_stage_counts(uuid), public.wm_target_for(text);
drop function if exists public.wm_assign(uuid, uuid, text, jsonb, jsonb, uuid[], text, int, int), public.wm_clean_cards(jsonb), public.wm_staff_academy();
drop function if exists public.wm_build_session(uuid), public.wm_new_item(uuid, text, jsonb), public.wm_review_item(uuid, text, jsonb, text), public.wm_mode_params(text), public.wm_card(jsonb, text);
drop function if exists public.wm_first_q(jsonb, jsonb, text[]), public.wm_pick_styles(public.wm_words, text, text[]);
drop function if exists public.wm_make_q(jsonb, text, jsonb), public.wm_choice_q(text, text, text, text, text, text, text[], text), public.wm_distractors(jsonb, jsonb, text, int);
drop function if exists public.wm_shuffle(text[]), public.wm_answer_text(jsonb), public.wm_grade(jsonb, text), public.wm_norm(text), public.wm_key(text, text), public.wm_today(), public.wm_now();
drop table if exists public.wm_answers, public.wm_sessions, public.wm_words, public.wm_targets, public.wm_plans;
