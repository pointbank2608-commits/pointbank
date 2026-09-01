-- 게임 이미지(다이어그램 배경, 이미지 퀴즈 사진)를 담을 공개 버킷.
-- game-audio 버킷과 동일한 규칙: "<academy_id>/<uuid>.<확장자>", RLS 로 같은 학원만 읽고
-- 선생님만 올리고 지울 수 있게 한다.

insert into storage.buckets (id, name, public)
values ('game-images', 'game-images', true)
on conflict (id) do nothing;

drop policy if exists game_images_insert on storage.objects;
create policy game_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'game-images'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  );

drop policy if exists game_images_select on storage.objects;
create policy game_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'game-images'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
  );

drop policy if exists game_images_delete on storage.objects;
create policy game_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'game-images'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  );
