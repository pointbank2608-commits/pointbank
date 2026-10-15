-- 078e: 점검 자동 띠 — 같은 오류가 10분 안에 서로 다른 사용자 5명 이상에게 나면 상단 띠를 자동으로 띄우고,
-- 15분 동안 잠잠하면 자동으로 내린다. 5분마다 pg_cron 으로 호출(맨 아래 주석 참고).

alter table public.announcements add column if not exists auto_key text;
create unique index if not exists announcements_auto_key_idx on public.announcements (auto_key)
  where auto_key is not null and ends_at is null;

create or replace function public.ops_health_tick()
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_spike boolean;
  v_quiet boolean;
  v_active boolean;
begin
  select exists (
    select 1 from public.client_errors
     where created_at > now() - interval '10 minutes' and user_id is not null
     group by fingerprint
    having count(distinct user_id) >= 5
  ) into v_spike;

  select not exists (
    select 1 from public.client_errors
     where created_at > now() - interval '15 minutes' and user_id is not null
  ) into v_quiet;

  select exists (
    select 1 from public.announcements where auto_key = 'auto_health' and ends_at is null
  ) into v_active;

  if v_spike and not v_active then
    insert into public.announcements (title, body, level, audience, banner, popup, auto_key)
    values ('일부 기능이 불안정해요',
            '지금 일부 기능에서 문제가 생겨 확인하고 있어요. 잠시 뒤 다시 시도해 주세요. 수업 중이라면 새로고침을 한 번 해 보세요.',
            'maintenance', 'all', true, false, 'auto_health');
    return 'banner_on';
  end if;

  if v_active and v_quiet then
    update public.announcements set ends_at = now()
     where auto_key = 'auto_health' and ends_at is null;
    return 'banner_off';
  end if;

  return 'ok';
end $$;

revoke execute on function public.ops_health_tick() from public, anon, authenticated;
grant execute on function public.ops_health_tick() to service_role;

-- 예약(pg_cron 을 켠 뒤 project-ref 와 CRON_SECRET 을 채워 따로 실행)
-- select cron.schedule('ops-health-tick', '*/5 * * * *', $$ select public.ops_health_tick(); $$);
-- select cron.schedule('weekly-report', '0 0 * * 1', $$
--   select net.http_post(
--     url := 'https://<project-ref>.supabase.co/functions/v1/weekly-report',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET 값>'),
--     body := '{}'::jsonb);
-- $$);
