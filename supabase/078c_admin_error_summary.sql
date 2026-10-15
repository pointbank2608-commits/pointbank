-- 078c: 관리자 "최근 오류" 목록(같은 오류끼리 묶어 많이 난 순서)

create or replace function public.admin_error_summary(p_hours int default 24)
returns table (
  fingerprint text,
  message text,
  page text,
  sample_stack text,
  events int,
  users int,
  academies int,
  first_seen timestamptz,
  last_seen timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    e.fingerprint,
    (array_agg(e.message order by e.created_at desc))[1],
    (array_agg(e.page order by e.created_at desc))[1],
    (array_agg(e.stack order by e.created_at desc))[1],
    count(*)::int,
    count(distinct e.user_id)::int,
    count(distinct e.academy_id)::int,
    min(e.created_at),
    max(e.created_at)
  from public.client_errors e
  where public.is_platform_admin()
    and e.created_at > now() - make_interval(hours => greatest(1, least(coalesce(p_hours, 24), 336)))
  group by e.fingerprint
  order by count(distinct e.user_id) desc, count(*) desc
  limit 30;
$$;

revoke execute on function public.admin_error_summary(int) from public;
grant execute on function public.admin_error_summary(int) to authenticated;
