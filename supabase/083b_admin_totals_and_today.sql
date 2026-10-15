-- 083b: 목록 위 합계 + "오늘 할 일" 학원 줄(전체를 읽지 않고 문제 있는 곳만 20곳씩)

create or replace function public.admin_totals()
returns json
language sql stable security definer set search_path = public
as $$
  select case when not public.is_platform_admin() then null else json_build_object(
    'academies', (select count(*) from public.academies),
    'teachers', (select count(*) from public.profiles where role in ('owner', 'teacher') and academy_id is not null),
    'students', (select count(*) from public.students)
  ) end
$$;

create or replace function public.admin_today_lists()
returns json
language plpgsql stable security definer set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not public.is_platform_admin() then
    return null;
  end if;

  return json_build_object(
    'billing_total', (select count(*) from public.academies a
                       where a.billing_failure_count > 0 or a.plan_status = 'pending_cancel'
                          or (a.plan = 'paid' and a.plan_expires_at is not null and a.plan_expires_at <= v_today + 7)),
    'billing', (select coalesce(json_agg(x), '[]'::json) from (
        select a.id as academy_id, a.name, a.billing_failure_count, a.plan_status, a.plan_expires_at
          from public.academies a
         where a.billing_failure_count > 0 or a.plan_status = 'pending_cancel'
            or (a.plan = 'paid' and a.plan_expires_at is not null and a.plan_expires_at <= v_today + 7)
         order by a.billing_failure_count desc, a.plan_expires_at nulls last limit 20) x),
    'fresh_total', (select count(*) from public.academies where created_at >= now() - interval '7 days'),
    'fresh', (select coalesce(json_agg(x), '[]'::json) from (
        select a.id as academy_id, a.name, a.created_at,
               (select count(*) from public.students s where s.academy_id = a.id) as student_count,
               (select count(*) from public.curriculum_lessons l where l.academy_id = a.id) as lesson_count
          from public.academies a
         where a.created_at >= now() - interval '7 days'
         order by a.created_at desc limit 20) x),
    'dormant_total', (select count(*) from public.academies a
                       where a.plan = 'paid' and not exists (
                         select 1 from public.profiles p join auth.users u on u.id = p.id
                          where p.academy_id = a.id and u.last_sign_in_at >= now() - interval '14 days')),
    'dormant', (select coalesce(json_agg(x), '[]'::json) from (
        select a.id as academy_id, a.name,
               (select max(u.last_sign_in_at) from public.profiles p join auth.users u on u.id = p.id
                 where p.academy_id = a.id) as last_active_at
          from public.academies a
         where a.plan = 'paid' and not exists (
                 select 1 from public.profiles p join auth.users u on u.id = p.id
                  where p.academy_id = a.id and u.last_sign_in_at >= now() - interval '14 days')
         order by a.created_at limit 20) x)
  );
end $$;

revoke execute on function public.admin_totals() from public, anon;
revoke execute on function public.admin_today_lists() from public, anon;
grant execute on function public.admin_totals() to authenticated;
grant execute on function public.admin_today_lists() to authenticated;
