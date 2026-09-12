-- "내 커리큘럼" — 반별로 묶어두는 수업 유닛. word_lists 를 그대로 참조하고(단어 데이터를
-- 중복 저장하지 않음), 여기에 영상(유튜브)과 게임 재생목록(순서 있는 GameType 배열)을
-- 얹어서 "오늘 이 반 수업 하나"를 완성한다. word_lists/game_templates 와 같은
-- academy/class 스코프 패턴을 그대로 따른다.

create table if not exists public.curriculum_lessons (
  id           uuid primary key default gen_random_uuid(),
  academy_id   uuid not null references public.academies(id) on delete cascade,
  class_id     uuid references public.classes(id) on delete set null, -- null = 학원 전체 공용
  name         text not null,
  word_list_id uuid references public.word_lists(id) on delete set null,
  video_url    text, -- 유튜브 영상 URL(선택). 쉐도잉/무비보기 단계에서 씀.
  level        text, -- 자유 태그(예: "초2", "P1") — 강제 아님, 화면 표시용.
  playlist     jsonb not null default '[]'::jsonb, -- [{id, gameType}][] — 이어서 진행할 게임 순서
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists curriculum_lessons_academy_idx on public.curriculum_lessons(academy_id);

alter table public.curriculum_lessons enable row level security;

drop policy if exists curriculum_lessons_select on public.curriculum_lessons;
create policy curriculum_lessons_select on public.curriculum_lessons
  for select using (academy_id = public.my_academy_id());

drop policy if exists curriculum_lessons_write on public.curriculum_lessons;
create policy curriculum_lessons_write on public.curriculum_lessons
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());
