-- 086t: 학원 삭제를 "즉시 영구 삭제"에서 "14일 유예 삭제"로 바꾼다(사유·기록 포함) + 자주 쓰는 조건 저장.
--
-- 조사 결과(2026-10-18): 예전 admin_delete_academy 는 확인 한 번으로 학원과 딸린 데이터를 바로 지웠고(연쇄 삭제),
-- 학원 단위로 되살릴 방법은 없었다(내용 되돌리기 content_revisions 는 수업·단어장·게임 내용 낱개만, 180일).
-- 이제: 일반 학원 = 삭제 요청(081 의 14일 유예, 그 안에는 취소 가능, 유예가 지나면 purge_due_deletions 가 지움).
--       테스트로 표시한 학원만 바로 지울 수 있다(운영 중인 학원이 실수로 영구 삭제되는 길을 막는다).

create or replace function public.admin_request_deletion(p_academy_id uuid, p_reason text)
returns timestamptz
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_at timestamptz;
begin
  if not public.is_platform_admin() then raise exception '관리자만 할 수 있어요.'; end if;
  if p_reason is null or length(trim(p_reason)) < 2 then raise exception '사유를 적어 주세요.'; end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then raise exception '학원을 찾을 수 없어요.'; end if;
  insert into public.academy_deletion_requests (academy_id, requested_by) values (p_academy_id, auth.uid()) on conflict (academy_id) do nothing;
  select requested_at into v_at from public.academy_deletion_requests where academy_id = p_academy_id;
  insert into public.admin_actions (academy_id, action, reason, after) values (p_academy_id, 'request_deletion', trim(p_reason), jsonb_build_object('requested_at', v_at));
  return v_at;
end $$;

create or replace function public.admin_cancel_deletion(p_academy_id uuid, p_reason text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then raise exception '관리자만 할 수 있어요.'; end if;
  if p_reason is null or length(trim(p_reason)) < 2 then raise exception '사유를 적어 주세요.'; end if;
  delete from public.academy_deletion_requests where academy_id = p_academy_id;
  insert into public.admin_actions (academy_id, action, reason) values (p_academy_id, 'cancel_deletion', trim(p_reason));
end $$;

-- 예전 이름 호환: 테스트 학원이면 바로 삭제, 아니면 삭제 요청(유예)으로 처리한다
create or replace function public.admin_delete_academy(p_academy_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_name text;
  v_test boolean;
begin
  if not public.is_platform_admin() then raise exception '관리자만 할 수 있어요.'; end if;
  select name, is_test into v_name, v_test from public.academies where id = p_academy_id;
  if v_name is null then raise exception '학원을 찾을 수 없어요.'; end if;
  if v_test then
    delete from public.academies where id = p_academy_id;
    insert into public.admin_actions (action, reason, before, result)
    values ('delete_test_academy', '(테스트 학원 삭제)', jsonb_build_object('name', v_name, 'academy_id', p_academy_id), 'success');
  else
    perform public.admin_request_deletion(p_academy_id, '(이전 화면에서 삭제 — 유예 삭제로 처리)');
  end if;
end $$;

create table if not exists public.admin_saved_filters (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null default auth.uid(),
  scope text not null check (scope in ('academies', 'tickets')),
  name text not null check (length(trim(name)) between 1 and 40),
  config jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.admin_saved_filters enable row level security;
drop policy if exists admin_saved_filters_own on public.admin_saved_filters;
create policy admin_saved_filters_own on public.admin_saved_filters
  for all using (public.is_platform_admin() and admin_id = auth.uid()) with check (public.is_platform_admin() and admin_id = auth.uid());

revoke all on function public.admin_request_deletion(uuid, text) from public, anon;
revoke all on function public.admin_cancel_deletion(uuid, text) from public, anon;
revoke all on function public.admin_delete_academy(uuid) from public, anon;
grant execute on function public.admin_request_deletion(uuid, text) to authenticated;
grant execute on function public.admin_cancel_deletion(uuid, text) to authenticated;
grant execute on function public.admin_delete_academy(uuid) to authenticated;
