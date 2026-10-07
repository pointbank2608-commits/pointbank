-- 047b: 개별수업 표를 로그인 없는 쪽(anon)에서 아예 못 읽게 권한을 닫는다.
-- 행 수준 보안(RLS)이 이미 막고 있지만, Supabase 가 새 표에 열어 둔 기본 권한까지 거둔다.
-- 학생은 표를 직접 읽지 않고 security definer 함수로만 접근한다. 선생님(authenticated)은 RLS 로 자기 학원 것만 본다.
revoke all on public.solo_lessons from anon;
revoke all on public.solo_assignments from anon;
revoke all on public.solo_step_events from anon, authenticated;

-- 확인(읽기 전용): 셋 다 true 여야 한다
select
  not has_table_privilege('anon', 'public.solo_lessons', 'select') as lessons_hidden_from_anon,
  not has_table_privilege('anon', 'public.solo_assignments', 'select') as assignments_hidden_from_anon,
  has_table_privilege('authenticated', 'public.solo_lessons', 'select') as teachers_can_read;
