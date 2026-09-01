-- 교육부 지정 초등 필수 영단어 800개 — 학원별이 아니라 플랫폼 전체가 공유하는 사전 데이터.
-- game_templates 와 다르게 academy_id 로 구분하지 않는다. 한 번 심어두면 모든 학원이
-- 그대로 읽어서 게임 콘텐츠로 가져다 쓴다.
--
-- id 는 uuid 가 아니라 사람이 읽을 수 있는 슬러그(예: "apple", "band-1", "band-2")다.
-- 뜻이 두 개 이상인 단어(예: band=끈/악단)는 한 행에 몰아넣지 않고 행을 나눠서
-- (band-1, band-2) 각각 하나의 뜻만 담는다 — 이래야 이미지도 헷갈리지 않고
-- 주제 분류(category)도 뜻 단위로 정확하게 매길 수 있다.

create table if not exists public.word_bank (
  id text primary key,
  word text not null,
  sense_number int not null default 1,
  part_of_speech text not null,
  meaning text not null,
  example_sentence text,
  category text,
  image_url text,
  sort_order int not null,
  created_at timestamptz not null default now()
);

create index if not exists word_bank_word_idx on public.word_bank (word);
create index if not exists word_bank_category_idx on public.word_bank (category);
create index if not exists word_bank_sort_order_idx on public.word_bank (sort_order);

alter table public.word_bank enable row level security;

-- 로그인한 사용자(선생님·학생 전부)는 전체 읽기만 가능. 쓰기는 앱에 UI를 안 두고
-- SQL Editor로만 관리한다(교사가 실수로 공용 사전을 건드리는 걸 막기 위함).
drop policy if exists word_bank_select on public.word_bank;
create policy word_bank_select on public.word_bank
  for select to authenticated using (true);

-- 이미지(word-bank-images 버킷)도 학원 구분 없이 전체 공용, 공개 버킷.
insert into storage.buckets (id, name, public)
values ('word-bank-images', 'word-bank-images', true)
on conflict (id) do nothing;

drop policy if exists word_bank_images_select on storage.objects;
create policy word_bank_images_select on storage.objects
  for select to authenticated
  using (bucket_id = 'word-bank-images');
