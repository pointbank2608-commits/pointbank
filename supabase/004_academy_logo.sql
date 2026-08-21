-- ============================================================
--  마이그레이션 004 — 학원 로고 업로드
--
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

-- 1. academies 테이블에 로고 URL 컬럼 추가
alter table public.academies
  add column if not exists logo_url text;

-- 2. 로고 이미지를 담을 공개 버킷 생성 (이미 있으면 건너뜀)
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- 3. 업로드 경로 규칙: "<academy_id>/logo.<확장자>"
--    폴더 이름(첫 세그먼트)이 자신의 academy_id 와 같을 때만,
--    그리고 선생님/원장일 때만 쓰기 허용. 읽기는 버킷이 public 이라 누구나 가능.
drop policy if exists logos_insert on storage.objects;
create policy logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  );

drop policy if exists logos_update on storage.objects;
create policy logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  )
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  );

drop policy if exists logos_delete on storage.objects;
create policy logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  );
