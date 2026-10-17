-- 086e: 문의 처리 상태(관리자용) — 선생님이 보는 status(open/answered/closed)는 그대로 두고, 운영 상태를 따로 둔다.
-- admin_state: new(신규) / in_progress(확인 중) / waiting_customer(고객 답변 대기) / waiting_internal(내부 확인 대기)
--              / needs_review(답변 검토 필요) / resolved(해결) / closed(종료)
-- 대기 시간: 고객 답변 대기는 마지막 관리자 답변부터, 나머지는 마지막 고객 메시지부터 센다(처리 지연과 구분).

alter table public.support_tickets
  add column if not exists admin_state text not null default 'new'
    check (admin_state in ('new', 'in_progress', 'waiting_customer', 'waiting_internal', 'needs_review', 'resolved', 'closed')),
  add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists incident_key text,
  add column if not exists last_user_msg_at timestamptz,
  add column if not exists last_admin_msg_at timestamptz,
  add column if not exists first_response_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists reopen_count int not null default 0;

create index if not exists support_tickets_admin_state_idx on public.support_tickets (admin_state, last_user_msg_at);
create index if not exists support_tickets_incident_idx on public.support_tickets (incident_key) where incident_key is not null;

-- 이미 있는 문의를 현재 데이터에 맞춰 채운다(여러 번 실행해도 같은 결과)
update public.support_tickets t set
  last_user_msg_at = coalesce(t.last_user_msg_at, (select max(m.created_at) from public.support_messages m where m.ticket_id = t.id and m.sender = 'user'), t.created_at),
  last_admin_msg_at = coalesce(t.last_admin_msg_at, (select max(m.created_at) from public.support_messages m where m.ticket_id = t.id and m.sender = 'admin')),
  first_response_at = coalesce(t.first_response_at, (select min(m.created_at) from public.support_messages m where m.ticket_id = t.id and m.sender = 'admin')),
  admin_state = case t.status when 'closed' then 'closed' when 'answered' then 'waiting_customer' else t.admin_state end
 where t.last_user_msg_at is null or t.first_response_at is null;

-- 응답 목표시간(시간) — admin_settings.support_sla_hours
create or replace function public.support_sla_hours(p_priority text)
returns numeric language sql stable security definer set search_path = public
as $$
  select coalesce((select (value ->> coalesce(p_priority, 'normal'))::numeric from public.admin_settings where key = 'support_sla_hours'),
                  case p_priority when 'urgent' then 2 when 'high' then 8 when 'low' then 72 else 24 end)
$$;
revoke all on function public.support_sla_hours(text) from public, anon;
grant execute on function public.support_sla_hours(text) to authenticated;
