-- ============================================================
--  마이그레이션 008 — 사다리/순서정하기 게임 + 게임 배경음악 업로드
--
--  Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

-- 1. game_templates 에 게임별 추가 설정(config) 컬럼 추가.
--    사다리의 결과 라벨, 선택한 배경음악(기본 제공/업로드) 등을 여기 담는다.
--    새 게임 종류가 생겨도 스키마 변경 없이 이 jsonb 하나로 확장 가능.
alter table public.game_templates
  add column if not exists config jsonb not null default '{}'::jsonb;

-- 2. 배경음악 파일을 담을 공개 버킷. 경로 규칙: "<academy_id>/<uuid>.<확장자>"
insert into storage.buckets (id, name, public)
values ('game-audio', 'game-audio', true)
on conflict (id) do nothing;

drop policy if exists game_audio_insert on storage.objects;
create policy game_audio_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'game-audio'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  );

drop policy if exists game_audio_select on storage.objects;
create policy game_audio_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'game-audio'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
  );

drop policy if exists game_audio_delete on storage.objects;
create policy game_audio_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'game-audio'
    and (storage.foldername(name))[1] = public.my_academy_id()::text
    and public.is_staff()
  );
