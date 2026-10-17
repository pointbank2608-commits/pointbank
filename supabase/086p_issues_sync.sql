-- 086p: 문제 목록 동기화(신호 → 문제) · 목록 · 상태 바꾸기
--
-- 동기화 규칙
--  · 신호가 있고 문제가 없으면 새로 만든다(open).
--  · 신호가 있고 문제가 이미 있으면 최근 시각·영향 수를 갱신한다. 해결(resolved)된 문제는 신호의 최근 발생 시각이
--    해결 시각보다 뒤일 때만 open 으로 되돌리고 재발 횟수를 올린다(해결 전의 오래된 기록 때문에 되살아나지 않는다).
--  · 신호가 사라진 문제: 오류(error)는 자동으로 닫지 않는다(사람이 해결 처리해야 한다). 그 밖의 종류는 자동 해결로 닫는다.
--    자동 해결도 나중에 신호가 다시 나타나면 재발로 센다.

create or replace function public.admin_issues_sync()
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_new int := 0;
  v_recur int := 0;
  v_auto int := 0;
  v_started timestamptz := now();
  r record;
begin
  if not public.is_platform_admin() then raise exception 'not_allowed'; end if;

  for r in select * from public.admin_issue_signals loop
    insert into public.admin_issues (issue_key, kind, severity, title, summary, academies_affected, users_affected, first_seen, last_seen, ref)
    values (r.issue_key, r.kind, r.severity, left(r.title, 200), r.summary, r.academies_affected, r.users_affected, r.first_seen, r.last_seen, r.ref)
    on conflict (issue_key) do nothing;
    if found then
      v_new := v_new + 1;
    else
      update public.admin_issues i set
          severity = r.severity, title = left(r.title, 200), summary = r.summary,
          academies_affected = r.academies_affected, users_affected = r.users_affected,
          last_seen = greatest(i.last_seen, r.last_seen),
          status = case when i.status = 'resolved' and r.last_seen > i.resolved_at then 'open' else i.status end,
          recurrence_count = i.recurrence_count + case when i.status = 'resolved' and r.last_seen > i.resolved_at then 1 else 0 end,
          recurred_at = case when i.status = 'resolved' and r.last_seen > i.resolved_at then now() else i.recurred_at end,
          acknowledged_at = case when i.status = 'resolved' and r.last_seen > i.resolved_at then null else i.acknowledged_at end,
          auto_resolved = case when i.status = 'resolved' and r.last_seen > i.resolved_at then false else i.auto_resolved end,
          resolved_at = case when i.status = 'resolved' and r.last_seen > i.resolved_at then null else i.resolved_at end
        where i.issue_key = r.issue_key
          and (i.status <> 'resolved' or r.last_seen > i.resolved_at or i.last_seen < r.last_seen);
    end if;
  end loop;

  select count(*) into v_recur from public.admin_issues where status = 'open' and recurred_at >= v_started;

  update public.admin_issues i set status = 'resolved', resolved_at = now(), auto_resolved = true,
         resolution_note = '신호가 사라져 자동으로 닫았어요.'
   where i.status <> 'resolved' and i.kind <> 'error'
     and not exists (select 1 from public.admin_issue_signals s where s.issue_key = i.issue_key);
  get diagnostics v_auto = row_count;

  return jsonb_build_object('new', v_new, 'recurred', v_recur, 'auto_resolved', v_auto);
end $$;

-- 목록: 처리할 것(open·acknowledged)을 우선순위·최근 순으로, 해결된 것은 최근 10건만
create or replace function public.admin_issue_list(p_include_resolved boolean default false)
returns table (id uuid, issue_key text, kind text, severity int, title text, summary text, status text,
               academies_affected int, users_affected int, first_seen timestamptz, last_seen timestamptz, wait_minutes int,
               acknowledged_at timestamptz, resolved_at timestamptz, resolution_note text, auto_resolved boolean,
               recurrence_count int, recurred_at timestamptz, ref jsonb)
language sql stable security definer set search_path = public
as $$
  select * from (
    select i.id, i.issue_key, i.kind, i.severity, i.title, i.summary, i.status, i.academies_affected, i.users_affected,
           i.first_seen, i.last_seen, (extract(epoch from (now() - i.first_seen)) / 60)::int,
           i.acknowledged_at, i.resolved_at, i.resolution_note, i.auto_resolved, i.recurrence_count, i.recurred_at, i.ref
      from public.admin_issues i
     where public.is_platform_admin() and i.status <> 'resolved'
     order by i.severity, (i.recurrence_count > 0) desc, i.last_seen desc
  ) open_part
  union all
  select * from (
    select i.id, i.issue_key, i.kind, i.severity, i.title, i.summary, i.status, i.academies_affected, i.users_affected,
           i.first_seen, i.last_seen, (extract(epoch from (now() - i.first_seen)) / 60)::int,
           i.acknowledged_at, i.resolved_at, i.resolution_note, i.auto_resolved, i.recurrence_count, i.recurred_at, i.ref
      from public.admin_issues i
     where public.is_platform_admin() and coalesce(p_include_resolved, false) and i.status = 'resolved'
     order by i.resolved_at desc limit 10
  ) resolved_part;
$$;

-- 상태 바꾸기: acknowledged(확인 중) / resolved(처리 완료 — 메모 필수) / open(되돌리기)
create or replace function public.admin_issue_set(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_old public.admin_issues;
begin
  if not public.is_platform_admin() then raise exception 'not_allowed'; end if;
  if p_status not in ('open', 'acknowledged', 'resolved') then raise exception 'bad_status'; end if;
  if p_status = 'resolved' and (p_note is null or length(trim(p_note)) < 2) then raise exception '해결 내용을 한 줄 적어 주세요.'; end if;
  select * into v_old from public.admin_issues where id = p_id;
  if v_old.id is null then raise exception '문제를 찾을 수 없어요.'; end if;
  update public.admin_issues set
      status = p_status,
      acknowledged_at = case when p_status = 'acknowledged' then now() when p_status = 'open' then null else acknowledged_at end,
      acknowledged_by = case when p_status = 'acknowledged' then auth.uid() else acknowledged_by end,
      resolved_at = case when p_status = 'resolved' then now() else null end,
      resolved_by = case when p_status = 'resolved' then auth.uid() else null end,
      resolution_note = case when p_status = 'resolved' then trim(p_note) else resolution_note end,
      auto_resolved = false
    where id = p_id;
  insert into public.admin_actions (action, reason, before, after, detail)
  values ('issue_' || p_status, nullif(trim(coalesce(p_note, '')), ''), jsonb_build_object('status', v_old.status), jsonb_build_object('status', p_status),
          jsonb_build_object('issue', v_old.issue_key, 'title', v_old.title));
end $$;

revoke all on function public.admin_issues_sync() from public, anon;
revoke all on function public.admin_issue_list(boolean) from public, anon;
revoke all on function public.admin_issue_set(uuid, text, text) from public, anon;
grant execute on function public.admin_issues_sync() to authenticated;
grant execute on function public.admin_issue_list(boolean) to authenticated;
grant execute on function public.admin_issue_set(uuid, text, text) to authenticated;
