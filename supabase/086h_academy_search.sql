-- 086h: 학원·회원 목록 서버 검색(083a 를 대체) — 전부 서버에서 거르고·정렬하고·잘라서 최대 100곳만 내려보낸다.
-- 검색: 학원 이름 / 소속 계정(원장·선생님) 이메일·이름(소문자로 맞춰 찾는다).
-- 필터 이름은 admin_overview 의 숫자와 같은 조건이다: today·new7·active7·free·trial·trial_ending·paid·subscription·grant
--   ·unclassified·billing·expiring·dormant·tickets·test (카드를 누르면 같은 목록).
-- admin_academy_ids 가 "어느 학원이 해당되는가"를 한 곳에서 정한다 — 목록·대량 변경 대상이 같은 함수를 쓴다.

drop function if exists public.admin_academy_search(text, text, int, int);
drop function if exists public.admin_academy_search(text, text, int, int, text, text, boolean);

create or replace function public.admin_academy_ids(p_query text default '', p_filter text default 'all', p_exclude_test boolean default true)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  with prm as (
    select '%' || replace(replace(replace(lower(trim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as q,
           trim(coalesce(p_query, '')) = '' as no_q,
           (now() at time zone 'Asia/Seoul')::date as today,
           ((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul' as day_start,
           (((now() at time zone 'Asia/Seoul')::date - 6)::timestamp at time zone 'Asia/Seoul') as week_start
  ),
  hit as (select p.academy_id from public.profiles p join auth.users u on u.id = p.id, prm
           where not prm.no_q and p.academy_id is not null
             and (lower(u.email) like prm.q escape '\' or lower(p.display_name) like prm.q escape '\') group by 1)
  select r.id from public.admin_academy_rollup r cross join prm
   where (not coalesce(p_exclude_test, true) or not r.is_test or p_filter = 'test')
     and (prm.no_q or lower(r.name) like prm.q escape '\' or r.id in (select academy_id from hit))
     and case coalesce(p_filter, 'all')
           when 'today' then r.created_at >= prm.day_start
           when 'new7' then r.created_at >= prm.week_start
           when 'active7' then r.last_active >= now() - interval '7 days'
           when 'free' then r.entitlement = 'free'
           when 'trial' then r.entitlement = 'trial'
           when 'trial_ending' then r.entitlement = 'trial' and r.trial_ends_at <= prm.today + 3
           when 'paid' then r.entitlement = 'full'
           when 'subscription' then r.source = 'subscription'
           when 'grant' then r.source in ('admin', 'event')
           when 'unclassified' then r.source = 'unclassified'
           when 'billing' then r.billing_state in ('failed', 'cancel_scheduled')
           when 'expiring' then r.entitlement = 'full' and r.source <> 'subscription' and r.plan_expires_at is not null and r.plan_expires_at <= prm.today + 7
           when 'dormant' then r.entitlement = 'full' and coalesce(r.last_active, '-infinity'::timestamptz) < now() - interval '14 days'
           when 'tickets' then r.tickets > 0
           when 'test' then r.is_test
           else true end;
$$;

create or replace function public.admin_academy_search(
  p_query text default '', p_filter text default 'all', p_limit int default 50, p_offset int default 0,
  p_sort text default 'created', p_dir text default 'desc', p_exclude_test boolean default true)
returns table (
  academy_id uuid, name text, created_at timestamptz, is_test boolean,
  entitlement text, source text, billing_state text, plan_expires_at date, trial_ends_at date, billing_failure_count int,
  owner_email text, owner_name text, owner_count int, teacher_count int, student_count int, class_count int,
  last_active_at timestamptz, open_tickets int, total bigint)
language sql stable security definer set search_path = public
as $$
  with ids as (select i as id from public.admin_academy_ids(p_query, p_filter, p_exclude_test) i),
       tot as (select count(*) as n from ids)
  select b.id, b.name, b.created_at, b.is_test, b.entitlement, b.source, b.billing_state, b.plan_expires_at, b.trial_ends_at,
         b.billing_failure_count, b.o_email, b.o_name, b.owners, b.teachers, b.students, b.classes, b.last_active, b.tickets, (select n from tot)
    from public.admin_academy_rollup b join ids on ids.id = b.id
   order by
     case when p_sort = 'name' and p_dir = 'asc' then b.name end asc,
     case when p_sort = 'name' and p_dir <> 'asc' then b.name end desc,
     case when p_sort = 'students' and p_dir = 'asc' then b.students end asc,
     case when p_sort = 'students' and p_dir <> 'asc' then b.students end desc,
     case when p_sort = 'active' and p_dir = 'asc' then b.last_active end asc nulls first,
     case when p_sort = 'active' and p_dir <> 'asc' then b.last_active end desc nulls last,
     case when p_sort = 'trial' and p_dir = 'asc' then b.trial_ends_at end asc,
     case when p_sort = 'trial' and p_dir <> 'asc' then b.trial_ends_at end desc,
     case when coalesce(p_sort, 'created') = 'created' and p_dir = 'asc' then b.created_at end asc,
     case when coalesce(p_sort, 'created') = 'created' and coalesce(p_dir, 'desc') <> 'asc' then b.created_at end desc,
     b.id
   limit greatest(1, least(coalesce(p_limit, 50), 100)) offset greatest(0, coalesce(p_offset, 0));
$$;

revoke execute on function public.admin_academy_ids(text, text, boolean) from public, anon;
revoke execute on function public.admin_academy_search(text, text, int, int, text, text, boolean) from public, anon;
grant execute on function public.admin_academy_ids(text, text, boolean) to authenticated;
grant execute on function public.admin_academy_search(text, text, int, int, text, text, boolean) to authenticated;
