-- 083a: 관리자 학원 목록 서버 페이지네이션(2026-10-17) — 한 번에 최대 100곳만 읽는다.
-- 순서: 083a → 083b → 083c → 083_check.sql (하나씩 실행)
-- p_filter: all | paid | free | new | billing | dormant, p_query: 학원 이름·원장 이메일 일부
-- 맨 끝 total 은 필터에 맞는 전체 학원 수(페이지 이동용).

create or replace function public.admin_academy_search(
  p_query text default '',
  p_filter text default 'all',
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  academy_id uuid,
  name text,
  point_unit text,
  created_at timestamptz,
  plan text,
  plan_status text,
  plan_expires_at date,
  billing_failure_count int,
  owner_email text,
  owner_name text,
  owner_count int,
  teacher_count int,
  student_count int,
  last_active_at timestamptz,
  total bigint
)
language sql stable security definer set search_path = public
as $$
  with params as (
    select '%' || replace(replace(replace(trim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as q,
           trim(coalesce(p_query, '')) = '' as no_q,
           (now() at time zone 'Asia/Seoul')::date as today
  ),
  base as (
    select a.*
      from public.academies a, params
     where public.is_platform_admin()
       and (params.no_q
            or a.name ilike params.q
            or exists (select 1 from public.profiles p join auth.users u on u.id = p.id
                        where p.academy_id = a.id and p.role = 'owner' and u.email ilike params.q))
       and case coalesce(p_filter, 'all')
             when 'paid' then a.plan = 'paid'
             when 'free' then a.plan <> 'paid'
             when 'new' then a.created_at >= now() - interval '7 days'
             when 'billing' then a.billing_failure_count > 0
                              or a.plan_status = 'pending_cancel'
                              or (a.plan = 'paid' and a.plan_expires_at is not null and a.plan_expires_at <= params.today + 7)
             when 'dormant' then not exists (
                    select 1 from public.profiles p join auth.users u on u.id = p.id
                     where p.academy_id = a.id and u.last_sign_in_at >= now() - interval '14 days')
             else true
           end
  ),
  total as (select count(*) as n from base),
  paged as (
    select * from base order by created_at desc, id
     limit greatest(1, least(coalesce(p_limit, 50), 100)) offset greatest(0, coalesce(p_offset, 0))
  )
  select
    g.id, g.name, g.point_unit, g.created_at, g.plan, g.plan_status, g.plan_expires_at, g.billing_failure_count,
    (select u.email from public.profiles p join auth.users u on u.id = p.id
      where p.academy_id = g.id and p.role = 'owner' order by p.created_at limit 1)::text,
    (select p.display_name from public.profiles p where p.academy_id = g.id and p.role = 'owner' order by p.created_at limit 1),
    (select count(*) from public.profiles p where p.academy_id = g.id and p.role = 'owner')::int,
    (select count(*) from public.profiles p where p.academy_id = g.id and p.role = 'teacher')::int,
    (select count(*) from public.students s where s.academy_id = g.id)::int,
    (select max(u.last_sign_in_at) from public.profiles p join auth.users u on u.id = p.id where p.academy_id = g.id),
    (select n from total)
  from paged g
  order by g.created_at desc, g.id;
$$;

revoke execute on function public.admin_academy_search(text, text, int, int) from public, anon;
grant execute on function public.admin_academy_search(text, text, int, int) to authenticated;
