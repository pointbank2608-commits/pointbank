-- 086q: 오류 묶음 목록(같은 오류끼리) — 발생 횟수·영향 사용자/학원·최초/최근·경로·처리 상태.
-- 처리 상태는 admin_issues 의 'error:<지문>' 문제에서 가져온다(같은 곳에서 확인 중/해결/재발을 관리).
-- 해결 뒤 새로 난 횟수(events_after_resolved)가 있으면 "재발"로 보여 준다. 오래된 기록은 지우지 않는다(14일 뒤 자동 정리는 078b).
-- 빌드 버전은 수집하지 않는다(client_errors 에 열이 없음) — 배포 시각과 맞춰 볼 때는 최초/최근 시각을 쓴다.

create or replace function public.admin_error_groups(p_hours int default 168)
returns table (fingerprint text, message text, page text, sample_stack text, events int, users int, academies int,
               first_seen timestamptz, last_seen timestamptz, issue_id uuid, status text, recurrence_count int,
               resolved_at timestamptz, events_after_resolved int, issue_wait_minutes int)
language sql stable security definer set search_path = public
as $$
  with g as (
    select e.fingerprint,
           (array_agg(e.message order by e.created_at desc))[1] as message,
           (array_agg(e.page order by e.created_at desc))[1] as page,
           (array_agg(e.stack order by e.created_at desc))[1] as stack,
           count(*)::int as events, count(distinct e.user_id)::int as users, count(distinct e.academy_id)::int as academies,
           min(e.created_at) as first_seen, max(e.created_at) as last_seen
      from public.client_errors e
     where e.created_at > now() - make_interval(hours => greatest(1, least(coalesce(p_hours, 168), 336)))
     group by e.fingerprint
  )
  select g.fingerprint, g.message, g.page, g.stack, g.events, g.users, g.academies, g.first_seen, g.last_seen,
         i.id, coalesce(i.status, 'open'), coalesce(i.recurrence_count, 0), i.resolved_at,
         case when i.resolved_at is null then 0
              else (select count(*)::int from public.client_errors c where c.fingerprint = g.fingerprint and c.created_at > i.resolved_at) end,
         (extract(epoch from (now() - coalesce(i.first_seen, g.first_seen))) / 60)::int
    from g left join public.admin_issues i on i.issue_key = 'error:' || g.fingerprint
   where public.is_platform_admin()
   order by (coalesce(i.status, 'open') <> 'resolved') desc, g.users desc, g.events desc
   limit 100;
$$;

revoke all on function public.admin_error_groups(int) from public, anon;
grant execute on function public.admin_error_groups(int) to authenticated;
