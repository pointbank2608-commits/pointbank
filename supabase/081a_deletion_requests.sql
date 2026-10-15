-- 081a: 셀프 탈퇴(2026-10-17) — 원장이 학원 삭제를 요청하면 14일 유예 뒤 삭제된다(그 안에는 취소 가능).
-- 순서: 081a → 081b → 081c → 081d → 081_check.sql (하나씩 실행)

create table if not exists public.academy_deletion_requests (
  academy_id uuid primary key references public.academies(id) on delete cascade,
  requested_at timestamptz not null default now(),
  requested_by uuid
);

-- 직접 읽기·쓰기는 막고(정책 없음) 아래 함수로만 다룬다
alter table public.academy_deletion_requests enable row level security;

-- 원장만 요청할 수 있다
create or replace function public.request_academy_deletion()
returns timestamptz
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_academy uuid;
  v_at timestamptz;
begin
  select academy_id into v_academy from public.profiles where id = auth.uid() and role = 'owner';
  if v_academy is null then
    raise exception '원장님만 학원 삭제를 요청할 수 있어요.';
  end if;

  insert into public.academy_deletion_requests (academy_id, requested_by)
  values (v_academy, auth.uid())
  on conflict (academy_id) do nothing;

  select requested_at into v_at from public.academy_deletion_requests where academy_id = v_academy;
  return v_at;
end $$;

revoke execute on function public.request_academy_deletion() from public, anon;
grant execute on function public.request_academy_deletion() to authenticated;
