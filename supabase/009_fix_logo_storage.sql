-- ============================================================
--  마이그레이션 009 — 학원 로고 업로드 RLS 수정
--
--  upsert 시 storage.objects 를 먼저 읽는데 SELECT 정책이 없으면
--  "new row violates row-level security policy" 가 난다.
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

alter table public.academies
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- 공개 버킷이라도 객체 메타데이터를 읽으려면 SELECT 정책이 필요하다.
drop policy if exists logos_select on storage.objects;
create policy logos_select on storage.objects
  for select
  using (bucket_id = 'logos');

drop policy if exists logos_insert on storage.objects;
create policy logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and split_part(name, '/', 1) = public.my_academy_id()::text
    and public.is_staff()
  );

drop policy if exists logos_update on storage.objects;
create policy logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and split_part(name, '/', 1) = public.my_academy_id()::text
    and public.is_staff()
  )
  with check (
    bucket_id = 'logos'
    and split_part(name, '/', 1) = public.my_academy_id()::text
    and public.is_staff()
  );

drop policy if exists logos_delete on storage.objects;
create policy logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and split_part(name, '/', 1) = public.my_academy_id()::text
    and public.is_staff()
  );
