-- 086d: 관리자 지표(한 함수에서 모든 숫자를 같은 기준으로) + 테스트 표시
-- 기준: 날짜는 한국 시간. "오늘 가입" = 오늘 0시(KST) 이후. "최근 7일 가입" = 오늘 포함 7일(6일 전 0시~지금).
-- "최근 7일 로그인한 학원" = 7×24시간 안에 소속 계정이 로그인한 학원 수(중복 제거).
-- 회원(계정) = 학원에 소속된 원장·선생님 계정(한 계정은 한 학원에만 속한다). 학원 수와 다르다.
-- p_exclude_test = true 이면 테스트로 표시한 학원(과 그 소속 계정·학생)을 모든 숫자에서 뺀다.

create or replace function public.admin_overview(p_exclude_test boolean default true)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_day_start timestamptz := (v_today::timestamp at time zone 'Asia/Seoul');
  v_week_start timestamptz := ((v_today - 6)::timestamp at time zone 'Asia/Seoul');
  r jsonb;
begin
  if not public.is_platform_admin() then
    return null;
  end if;

  with f as (select * from public.admin_academy_facts where not (p_exclude_test and is_test))
  select jsonb_build_object(
    'asof', now(),
    'today_kst', v_today,
    'exclude_test', p_exclude_test,
    'test_academies', (select count(*) from public.academies where is_test),
    'academies', (select count(*) from f),
    'signups_today', (select count(*) from f where created_at >= v_day_start),
    'signups_7d', (select count(*) from f where created_at >= v_week_start),
    'accounts', (select count(*) from public.profiles p join f on f.id = p.academy_id where p.role in ('owner', 'teacher')),
    'owners', (select count(*) from public.profiles p join f on f.id = p.academy_id where p.role = 'owner'),
    'teachers', (select count(*) from public.profiles p join f on f.id = p.academy_id where p.role = 'teacher'),
    'students', (select count(*) from public.students s join f on f.id = s.academy_id),
    'active_7d', (select count(distinct p.academy_id) from public.profiles p join auth.users u on u.id = p.id join f on f.id = p.academy_id
                   where u.last_sign_in_at >= now() - interval '7 days'),
    'entitlement', jsonb_build_object(
        'free', (select count(*) from f where entitlement = 'free'),
        'trial', (select count(*) from f where entitlement = 'trial'),
        'full', (select count(*) from f where entitlement = 'full')),
    'trial_ending_3d', (select count(*) from f where entitlement = 'trial' and trial_ends_at <= v_today + 3),
    'source', jsonb_build_object(
        'subscription', (select count(*) from f where source = 'subscription'),
        'admin', (select count(*) from f where source = 'admin'),
        'event', (select count(*) from f where source = 'event'),
        'unclassified', (select count(*) from f where source = 'unclassified')),
    'billing', jsonb_build_object(
        'normal', (select count(*) from f where billing_state = 'normal'),
        'failed', (select count(*) from f where billing_state = 'failed'),
        'cancel_scheduled', (select count(*) from f where billing_state = 'cancel_scheduled')),
    'grants_expiring_7d', (select count(*) from f where entitlement = 'full' and source <> 'subscription'
                              and plan_expires_at is not null and plan_expires_at <= v_today + 7)
  ) into r;
  return r;
end $$;

create or replace function public.admin_set_academy_test(p_academy_id uuid, p_is_test boolean, p_reason text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_old boolean;
begin
  if not public.is_platform_admin() then raise exception '관리자만 할 수 있어요.'; end if;
  if p_reason is null or length(trim(p_reason)) < 2 then raise exception '변경 사유를 적어 주세요.'; end if;
  select is_test into v_old from public.academies where id = p_academy_id;
  if v_old is null then raise exception '학원을 찾을 수 없어요.'; end if;
  update public.academies set is_test = coalesce(p_is_test, false) where id = p_academy_id;
  insert into public.admin_actions (academy_id, action, reason, before, after)
  values (p_academy_id, 'set_test', trim(p_reason), jsonb_build_object('is_test', v_old), jsonb_build_object('is_test', coalesce(p_is_test, false)));
end $$;

revoke all on function public.admin_overview(boolean) from public, anon;
revoke all on function public.admin_set_academy_test(uuid, boolean, text) from public, anon;
grant execute on function public.admin_overview(boolean) to authenticated;
grant execute on function public.admin_set_academy_test(uuid, boolean, text) to authenticated;
