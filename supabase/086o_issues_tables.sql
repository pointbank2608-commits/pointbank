-- 086o: "오늘 할 일" 문제 목록 — 지금 처리해야 하는 문제를 우선순위·상태와 함께 모은다.
-- severity: 1 수업 진행을 막는 장애 / 2 결제·계정 상태 이상 / 3 확인이 필요한 오류·기한 지난 문의 / 4 실패한 자동 작업 / 5 확인이 필요한 신규·체험 계정
-- status: open(신규) / acknowledged(확인 중) / resolved(처리 완료). "확인"과 "해결"은 다르다(해결은 메모가 필요).
-- 해결된 문제의 같은 신호가 해결 시각 뒤에 다시 나타나면 open 으로 되돌리고 recurrence_count 를 올린다(재발이 묻히지 않는다).

create table if not exists public.admin_issues (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null unique,
  kind text not null check (kind in ('error', 'billing', 'account', 'ticket', 'job', 'review')),
  severity int not null check (severity between 1 and 5),
  title text not null,
  summary text,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  academies_affected int not null default 0,
  users_affected int not null default 0,
  first_seen timestamptz not null,
  last_seen timestamptz not null,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  auto_resolved boolean not null default false,
  recurrence_count int not null default 0,
  recurred_at timestamptz,
  ref jsonb not null default '{}'::jsonb
);
create index if not exists admin_issues_status_idx on public.admin_issues (status, severity, last_seen desc);

alter table public.admin_issues enable row level security;
drop policy if exists admin_issues_admin on public.admin_issues;
create policy admin_issues_admin on public.admin_issues for select using (public.is_platform_admin());

-- 지금 보이는 신호들(관리자 확인 없이 계산만 — 클라이언트에는 열지 않고 sync 함수가 쓴다)
create or replace view public.admin_issue_signals as
select 'error:' || e.fingerprint as issue_key, 'error' as kind,
       case when count(distinct e.user_id) filter (where e.created_at > now() - interval '60 minutes') >= 3 then 1 else 3 end as severity,
       (array_agg(e.message order by e.created_at desc))[1] as title,
       '경로 ' || coalesce((array_agg(e.page order by e.created_at desc))[1], '-') as summary,
       count(distinct e.academy_id)::int as academies_affected, count(distinct e.user_id)::int as users_affected,
       min(e.created_at) as first_seen, max(e.created_at) as last_seen,
       jsonb_build_object('fingerprint', e.fingerprint) as ref
  from public.client_errors e where e.created_at > now() - interval '24 hours' group by e.fingerprint
union all
select 'billing:' || a.id, 'billing', 2, a.name || ' — 결제 실패 ' || a.billing_failure_count || '회', '결제 수단과 재시도 결과를 확인하세요.', 1, 1,
       coalesce((select min(h.billed_at) from public.billing_history h where h.academy_id = a.id and h.status = 'failed'), now()), now(),
       jsonb_build_object('academy_id', a.id)
  from public.academies a where a.billing_failure_count > 0 and not a.is_test
union all
select 'account:unclassified', 'account', 2, '유료 권한인데 제공 근거가 미분류인 학원 ' || count(*) || '곳', '카드 없이 유료로 표시된 학원입니다. 관리자 제공·이벤트·구독 중 어느 것인지 분류하세요.',
       count(*)::int, 0, now(), now(), '{}'::jsonb
  from public.admin_academy_facts where entitlement = 'full' and source = 'unclassified' and not is_test having count(*) > 0
union all
select 'ticket:' || t.id, 'ticket', 3, t.subject, '응답 목표시간(' || public.support_sla_hours(t.priority) || '시간)을 넘겼습니다.', 1, 1,
       coalesce(t.last_user_msg_at, t.created_at), now(), jsonb_build_object('ticket_id', t.id, 'academy_id', t.academy_id)
  from public.support_tickets t
 where t.admin_state in ('new', 'in_progress', 'needs_review', 'waiting_internal')
   and now() - coalesce(t.last_user_msg_at, t.created_at) > make_interval(secs => public.support_sla_hours(t.priority) * 3600)
union all
select 'job:' || h.job_key, 'job', 4, h.title || (case h.health when 'failed' then ' — 마지막 실행 실패' when 'retry_wait' then ' — 실패 항목 재시도 대기' else ' — 기대 주기를 넘도록 성공 없음' end),
       coalesce(h.last_error, '자동 작업 상태를 확인하세요.'), 0, 0, coalesce(h.last_run_at, now()), now(), jsonb_build_object('job_key', h.job_key)
  from public.automation_jobs_health h where h.health in ('failed', 'retry_wait', 'stale')
union all
select 'review:stalled_new', 'review', 5, '가입 2일이 지나도 반을 만들지 않은 체험 계정 ' || count(*) || '곳', '도움말 안내 대상일 수 있습니다(가입 후 첫 사용 안내 작업의 모의 실행으로 미리 볼 수 있어요).',
       count(*)::int, count(*)::int, min(created_at), now(), '{}'::jsonb
  from public.admin_academy_rollup where entitlement = 'trial' and classes = 0 and not is_test
   and created_at < now() - interval '2 days' and created_at > now() - interval '14 days' having count(*) > 0;

revoke all on public.admin_issue_signals from public, anon, authenticated;
