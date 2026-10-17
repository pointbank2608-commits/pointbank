-- 086i: 문의함 서버 검색(031 의 admin_tickets 는 300건 상한·검색 없음) — 검색·상태·유형·긴급도·기한 초과·장애 묶음·정렬.
-- 대기 시간: 고객 답변 대기는 마지막 관리자 답변부터, 그 밖에는 마지막 고객 메시지부터(분).
-- overdue(기한 초과)는 "관리자가 처리할 차례"인 문의만 센다 — 고객 답변 대기는 처리 지연이 아니다.
-- p_state: active(해결·종료 제외, 기본) / all / new / in_progress / waiting_customer / waiting_internal / needs_review / resolved / closed

create or replace function public.admin_ticket_search(
  p_query text default '', p_state text default 'active', p_category text default null, p_priority text default null,
  p_overdue boolean default false, p_incident text default null, p_sort text default 'wait', p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, academy_id uuid, academy_name text, entitlement text, user_email text, user_name text, category text, subject text,
  status text, admin_state text, priority text, incident_key text, created_at timestamptz, updated_at timestamptz,
  waiting_since timestamptz, wait_minutes int, sla_hours numeric, overdue boolean, admin_unread boolean,
  reopen_count int, first_response_minutes int, errors_24h int, same_incident int, total bigint)
language sql stable security definer set search_path = public
as $$
  with prm as (
    select '%' || replace(replace(replace(lower(trim(coalesce(p_query, ''))), '\', '\\'), '%', '\%'), '_', '\_') || '%' as q,
           trim(coalesce(p_query, '')) = '' as no_q
  ),
  base as (
    select t.*, a.name as a_name, f.entitlement as ent, u.email::text as u_email, p.display_name as u_name,
           case t.admin_state when 'waiting_customer' then t.last_admin_msg_at when 'resolved' then null when 'closed' then null
                else coalesce(t.last_user_msg_at, t.created_at) end as w_since
      from public.support_tickets t cross join prm
      left join public.academies a on a.id = t.academy_id
      left join public.admin_academy_facts f on f.id = t.academy_id
      left join auth.users u on u.id = t.user_id
      left join public.profiles p on p.id = t.user_id
     where public.is_platform_admin()
       and case coalesce(p_state, 'active') when 'active' then t.admin_state not in ('resolved', 'closed') when 'all' then true else t.admin_state = p_state end
       and (p_category is null or t.category = p_category)
       and (p_priority is null or t.priority = p_priority)
       and (p_incident is null or t.incident_key = p_incident)
       and (prm.no_q or lower(t.subject) like prm.q escape '\' or lower(coalesce(a.name, '')) like prm.q escape '\'
            or lower(coalesce(u.email, '')) like prm.q escape '\' or lower(coalesce(p.display_name, '')) like prm.q escape '\'
            or exists (select 1 from public.support_messages m where m.ticket_id = t.id and lower(m.body) like prm.q escape '\'))
  ),
  calc as (
    select b.*, (extract(epoch from (now() - b.w_since)) / 60)::int as wait_min, public.support_sla_hours(b.priority) as sla,
           (b.admin_state in ('new', 'in_progress', 'needs_review', 'waiting_internal') and b.w_since is not null
            and now() - b.w_since > make_interval(secs => public.support_sla_hours(b.priority) * 3600)) as late
      from base b
  ),
  fin as (select * from calc where not coalesce(p_overdue, false) or late),
  tot as (select count(*) as n from fin)
  select c.id, c.academy_id, c.a_name, c.ent, c.u_email, c.u_name, c.category, c.subject, c.status, c.admin_state, c.priority, c.incident_key,
         c.created_at, c.updated_at, c.w_since, c.wait_min, c.sla, c.late, c.admin_unread, c.reopen_count,
         (extract(epoch from (c.first_response_at - c.created_at)) / 60)::int,
         (select count(*)::int from public.client_errors e where e.academy_id = c.academy_id and e.created_at > now() - interval '24 hours'),
         (case when c.incident_key is null then 0 else (select count(*)::int from public.support_tickets s where s.incident_key = c.incident_key) end),
         (select n from tot)
    from fin c
   order by
     case when p_sort = 'newest' then c.created_at end desc,
     case when p_sort = 'priority' then case c.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end end asc,
     case when coalesce(p_sort, 'wait') = 'wait' then (case when c.late then 0 else 1 end) end asc,
     case when coalesce(p_sort, 'wait') = 'wait' then c.wait_min end desc nulls last,
     c.created_at desc, c.id
   limit greatest(1, least(coalesce(p_limit, 50), 100)) offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.admin_ticket_search(text, text, text, text, boolean, text, text, int, int) from public, anon;
grant execute on function public.admin_ticket_search(text, text, text, text, boolean, text, text, int, int) to authenticated;
