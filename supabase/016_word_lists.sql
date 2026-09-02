-- 선생님이 수업/반별로 만들어두는 단어장 — game_templates 와 같은 academy/class 스코프
-- 패턴이지만 게임 종류(game_type)와 무관하다. 게임 쪽(WordListPicker)에서 이 목록을 불러와
-- 각 게임이 쓰는 모양(GameItem[]/MatchPair[]/ImageQuizItem[])으로 변환해서 채운다.
--
-- items 는 word_bank 와 같은 필드 이름(word/meaning/image_url)을 쓴다 — "사전에서 선택"으로
-- 만들 때 word_bank 행을 거의 그대로 복사해 넣기 때문. "직접 입력"으로 만들면 image_url 은
-- null.

create table if not exists public.word_lists (
  id         uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  class_id   uuid references public.classes(id) on delete set null, -- null = 학원 전체 공용
  name       text not null,
  items      jsonb not null default '[]'::jsonb, -- {id, word, meaning, image_url}[]
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists word_lists_academy_idx on public.word_lists(academy_id);

alter table public.word_lists enable row level security;

drop policy if exists word_lists_select on public.word_lists;
create policy word_lists_select on public.word_lists
  for select using (academy_id = public.my_academy_id());

drop policy if exists word_lists_write on public.word_lists;
create policy word_lists_write on public.word_lists
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());
