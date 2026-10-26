-- 090l 학생 포털(/s) 홈에 단어암기숙제 링크를 보여 주기 위한 목록. 포털 로그인 열쇠(student_sessions)로만 읽는다.
-- 이 함수는 student_home 을 바꾸지 않고 따로 부른다(045 가 먼저 적용돼 있어야 한다).

create or replace function public.wm_student_links(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_sid uuid;
  v_today date := public.wm_today();
begin
  begin
    v_sid := public.student_session_student(p_token);
  exception when others then
    return '[]'::jsonb;
  end;
  return coalesce((
    select jsonb_agg(jsonb_build_object('title', p.title, 'access', t.access_token,
             'phase', case when v_today - p.start_date < p.study_days then 'study' else 'review' end) order by p.created_at desc)
      from public.wm_targets t join public.wm_plans p on p.id = t.plan_id
     where t.student_id = v_sid and p.closed_at is null and v_today - p.start_date < p.study_days + p.review_days
       and public.academy_feature(p.academy_id, 'homework')), '[]'::jsonb);
end $$;
