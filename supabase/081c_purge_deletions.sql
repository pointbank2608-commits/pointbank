-- 081c: 유예(14일)가 지난 학원을 실제로 지운다 — 학원 데이터(연쇄 삭제), 소속 계정, 그 계정들의 문의.
-- 5분마다 도는 ops-health-tick 처럼 pg_cron 에 매일 한 번 등록하거나, 관리자 "오늘 할 일"을 열 때 같이 부른다.
-- Storage 에 올린 파일(캡처·게임 사진)은 이 함수로 지워지지 않는다(관리자가 따로 정리).

create or replace function public.purge_due_deletions()
returns int
language plpgsql volatile security definer set search_path = public
as $$
declare
  r record;
  v_ids uuid[];
  v_n int := 0;
begin
  if auth.role() <> 'service_role' and not public.is_platform_admin() then
    raise exception '권한이 없어요.';
  end if;

  for r in
    select d.academy_id, a.name
      from public.academy_deletion_requests d
      join public.academies a on a.id = d.academy_id
     where d.requested_at < now() - interval '14 days'
  loop
    select coalesce(array_agg(id), '{}') into v_ids
      from public.profiles
     where academy_id = r.academy_id and role in ('owner', 'teacher');

    delete from public.support_tickets where user_id = any(v_ids);
    delete from public.announcement_reads where user_id = any(v_ids);
    delete from public.academies where id = r.academy_id;
    delete from auth.users where id = any(v_ids);

    insert into public.admin_actions (action, detail)
    values ('purge_academy', json_build_object('name', r.name, 'accounts', coalesce(array_length(v_ids, 1), 0))::jsonb);
    v_n := v_n + 1;
  end loop;

  return v_n;
end $$;

revoke execute on function public.purge_due_deletions() from public, anon;
grant execute on function public.purge_due_deletions() to authenticated, service_role;

-- 예약(pg_cron 을 켠 뒤 따로 실행)
-- select cron.schedule('purge-deletions', '30 18 * * *', $$ select public.purge_due_deletions(); $$);
