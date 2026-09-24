-- 커리큘럼 슬라이드(캔바/PPT를 이미지로 내보낸 것)를 담을 공개 버킷.
-- game-images 버킷과 동일한 규칙("<academy_id>/<uuid>.<확장자>", RLS 로 같은 학원만 읽고
-- 선생님만 올리고 지울 수 있게 함)이지만, 슬라이드 이미지는 레슨 삭제 시 정리 대상이 될 수
-- 있어(011_game_images.sql 이 쓰는 라벨 다이어그램·이미지 퀴즈 용례와 섞이지 않게) 별도
-- 버킷으로 둔다.

insert into storage.buckets (id, name, public)
values ('lesson-slide-images', 'lesson-slide-images', true)
on conflict (id) do nothing;

drop policy if exists lesson_slide_images_insert on storage.objects;
create policy lesson_slide_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lesson-slide-images'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  );

drop policy if exists lesson_slide_images_select on storage.objects;
create policy lesson_slide_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'lesson-slide-images'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
  );

drop policy if exists lesson_slide_images_delete on storage.objects;
create policy lesson_slide_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lesson-slide-images'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  );
