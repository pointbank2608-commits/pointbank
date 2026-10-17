-- 086b: 관리자 설정 표 + 조치 기록 확장(2026-10-18)
-- 조치 기록에 사유·결과·대량 작업 묶음 번호·변경 전후를 구조화해 남긴다(읽기 쉬운 목록 + 권한 있는 상세 보기).

create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
alter table public.admin_settings enable row level security;
drop policy if exists admin_settings_admin on public.admin_settings;
create policy admin_settings_admin on public.admin_settings
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- 응답 목표시간(시간) — 긴급도별. 문의 응답 기한 초과 표시와 "오늘 할 일"이 같은 값을 쓴다.
insert into public.admin_settings (key, value)
values ('support_sla_hours', '{"urgent": 2, "high": 8, "normal": 24, "low": 72}'::jsonb)
on conflict (key) do nothing;

alter table public.admin_actions
  add column if not exists reason text,
  add column if not exists result text not null default 'success' check (result in ('success', 'failed', 'partial')),
  add column if not exists batch_id uuid,
  add column if not exists before jsonb,
  add column if not exists after jsonb;
create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_batch_idx on public.admin_actions (batch_id) where batch_id is not null;

-- 읽기 쉬운 조치 목록(원본 detail 은 담지 않는다 — 아래 상세 함수로 따로)
create or replace function public.admin_action_log(p_academy uuid default null, p_limit int default 50, p_offset int default 0)
returns table (id uuid, created_at timestamptz, actor_email text, academy_id uuid, academy_name text,
               action text, reason text, result text, batch_id uuid, before jsonb, after jsonb)
language sql stable security definer set search_path = public
as $$
  select x.id, x.created_at, u.email::text, x.academy_id, a.name, x.action, x.reason, x.result, x.batch_id, x.before, x.after
    from public.admin_actions x
    left join auth.users u on u.id = x.admin_id
    left join public.academies a on a.id = x.academy_id
   where public.is_platform_admin() and (p_academy is null or x.academy_id = p_academy)
   order by x.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.admin_action_detail(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when public.is_platform_admin() then (select to_jsonb(x) from public.admin_actions x where x.id = p_id) end;
$$;

revoke all on function public.admin_action_log(uuid, int, int) from public, anon;
revoke all on function public.admin_action_detail(uuid) from public, anon;
grant execute on function public.admin_action_log(uuid, int, int) to authenticated;
grant execute on function public.admin_action_detail(uuid) to authenticated;
