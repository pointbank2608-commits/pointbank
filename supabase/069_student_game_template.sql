-- 069: 학생이 개별수업 안에서 선생님이 만든 "게임 템플릿"을 읽는 창구.
-- 학생은 선생님 로그인이 없고 기기 열쇠(045 student_sessions)만 있어서 game_templates 표를 직접 못 읽는다.
-- 이 함수는 열쇠로 학생을 확인하고, 그 학생의 학원 템플릿(학원 공용이거나 그 학생 반 것)만 내용을 돌려준다.
-- 표 자체를 학생에게 열어 주는 것이 아니다.

create or replace function public.student_game_template(p_token uuid, p_template uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_sid uuid;
  v_academy uuid;
  v_class uuid;
  v_t public.game_templates;
begin
  begin
    v_sid := public.student_session_student(p_token);
  exception when others then
    return jsonb_build_object('error', 'expired');
  end;
  select academy_id, class_id into v_academy, v_class from public.students where id = v_sid;
  select * into v_t from public.game_templates where id = p_template;
  if v_t.id is null or v_t.academy_id is distinct from v_academy or (v_t.class_id is not null and v_t.class_id is distinct from v_class) then
    return jsonb_build_object('error', 'not_found');
  end if;
  return jsonb_build_object(
    'game_type', v_t.game_type,
    'name', v_t.name,
    'items', v_t.items,
    'config', coalesce(to_jsonb(v_t) -> 'config', '{}'::jsonb)
  );
end $$;

revoke all on function public.student_game_template(uuid, uuid) from public, anon, authenticated;
grant execute on function public.student_game_template(uuid, uuid) to anon, authenticated;
