-- 브랜드 로고 저장소(2026-10-17) — 로고 그림(symbol·logo·wordmark .webp)을 공개 버킷 `brand`에 두고 앱이 불러 쓴다.
-- 읽기는 누구나(공개 주소), 올리기·바꾸기·지우기는 플랫폼 관리자만(관리자 > 로고 탭). 파일이 없으면 앱이 내장 로고(/brand/…)로 대신 보여 준다.

insert into storage.buckets (id, name, public)
values ('brand', 'brand', true)
on conflict (id) do update set public = true;

drop policy if exists brand_select on storage.objects;
create policy brand_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'brand');

drop policy if exists brand_insert on storage.objects;
create policy brand_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'brand' and public.is_platform_admin());

drop policy if exists brand_update on storage.objects;
create policy brand_update on storage.objects
  for update to authenticated
  using (bucket_id = 'brand' and public.is_platform_admin())
  with check (bucket_id = 'brand' and public.is_platform_admin());

drop policy if exists brand_delete on storage.objects;
create policy brand_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'brand' and public.is_platform_admin());
