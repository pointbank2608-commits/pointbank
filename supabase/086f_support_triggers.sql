-- 086f: 문의 메시지·상태가 바뀌면 운영 상태(admin_state)와 대기 시각을 맞춘다. 선생님 화면용 status 규칙은 그대로.

create or replace function public.support_message_touch()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.sender = 'admin' then
    update public.support_tickets
       set status = 'answered', user_unread = true, admin_unread = false, updated_at = now(),
           last_admin_msg_at = now(), first_response_at = coalesce(first_response_at, now()),
           admin_state = case when admin_state in ('resolved', 'closed') then admin_state else 'waiting_customer' end
     where id = new.ticket_id;
  else
    update public.support_tickets
       set status = 'open', user_unread = false, admin_unread = true, updated_at = now(),
           last_user_msg_at = now(),
           reopen_count = reopen_count + case when admin_state in ('resolved', 'closed') then 1 else 0 end,
           resolved_at = case when admin_state in ('resolved', 'closed') then null else resolved_at end,
           admin_state = case when admin_state in ('in_progress', 'needs_review', 'waiting_internal') then admin_state else 'new' end
     where id = new.ticket_id;
  end if;
  return new;
end $$;

-- 선생님/관리자가 status 를 직접 닫거나 다시 열면 운영 상태도 따라간다
create or replace function public.support_status_sync()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'closed' and new.admin_state <> 'closed' then
      new.admin_state := 'closed';
      new.resolved_at := coalesce(new.resolved_at, now());
    elsif old.status = 'closed' and new.status <> 'closed' and new.admin_state = 'closed' then
      new.admin_state := 'new';
      new.resolved_at := null;
    end if;
  end if;
  if new.admin_state is distinct from old.admin_state and new.admin_state in ('resolved', 'closed') then
    new.resolved_at := coalesce(new.resolved_at, now());
  end if;
  return new;
end $$;

drop trigger if exists support_status_sync on public.support_tickets;
create trigger support_status_sync before update on public.support_tickets
  for each row execute function public.support_status_sync();

-- 운영 상태·긴급도·장애 묶음 바꾸기(변경 전후를 조치 기록에 남긴다)
create or replace function public.admin_ticket_set(
  p_id uuid, p_state text default null, p_priority text default null, p_incident text default null, p_clear_incident boolean default false)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_old public.support_tickets;
begin
  if not public.is_platform_admin() then raise exception '관리자만 할 수 있어요.'; end if;
  select * into v_old from public.support_tickets where id = p_id;
  if v_old.id is null then raise exception '문의를 찾을 수 없어요.'; end if;
  update public.support_tickets
     set admin_state = coalesce(p_state, admin_state),
         priority = coalesce(p_priority, priority),
         incident_key = case when p_clear_incident then null else coalesce(nullif(trim(p_incident), ''), incident_key) end,
         status = case when p_state = 'closed' then 'closed' when p_state in ('resolved') and status = 'open' then 'answered' else status end,
         admin_unread = false
   where id = p_id;
  insert into public.admin_actions (academy_id, action, before, after, detail)
  values (v_old.academy_id, 'ticket_update',
          jsonb_build_object('state', v_old.admin_state, 'priority', v_old.priority, 'incident', v_old.incident_key),
          jsonb_build_object('state', coalesce(p_state, v_old.admin_state), 'priority', coalesce(p_priority, v_old.priority),
                             'incident', case when p_clear_incident then null else coalesce(nullif(trim(p_incident), ''), v_old.incident_key) end),
          jsonb_build_object('ticket_id', p_id));
end $$;

revoke all on function public.admin_ticket_set(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.admin_ticket_set(uuid, text, text, text, boolean) to authenticated;
