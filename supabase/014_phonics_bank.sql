-- 파닉스(소리 규칙) 단어 목록 — word_bank 와 같은 성격의 플랫폼 전체 공유 데이터.
-- academy_id 로 구분하지 않는다.
--
-- 같은 단어라도 학습 단계(step)마다 다른 소리 규칙을 가르치기 위해 다시 등장할 수 있고
-- (예: cat 은 1단계 "C" 알파벳 소리, 2단계 "짧은 a" 모음 소리), 아주 드물게 같은 단계
-- 안에서도 서로 다른 규칙의 예시로 두 번 쓰인다(예: brush 는 4단계에서 "br" 자음군과
-- "sh" 이중자음 둘 다의 예시) — 그래서 id 는 word 가 아니라 "word-s{step}" 슬러그를
-- 기본으로 하고, 같은 단계 안에서 중복되면 뒤에 -1/-2 를 덧붙인다.
--
-- pattern_marked 는 word 안에서 소리 규칙에 해당하는 글자를 {} 로 감싼 문자열이다
-- (예: "r{ai}n", 비연속 규칙은 "b{a}k{e}" 처럼 {} 를 두 번 쓴다). AI 이미지 생성에 규칙
-- 강조 텍스트를 넣지 않고, 앱이 이 마커를 파싱해서 색깔 있는 <span> 으로 직접 렌더링한다
-- (word_bank 이미지에 글자를 넣었다가 한글이 깨진 것과 같은 문제를 피하기 위함).
--
-- image_url 은 word_bank 와 동일하게 word 기준으로 계산한다 — 같은 단어가 여러 단계에
-- 등장해도 이미지 하나만 있으면 된다(app/public/phonics-images/<word>.png, Cursor 가
-- 채워 넣는 정적 파일, 별도 Storage 버킷 아님).

create table if not exists public.phonics_bank (
  id text primary key,
  word text not null,
  pattern_marked text not null,
  step int not null,
  rule text not null,
  meaning text,
  image_url text,
  sort_order int not null,
  created_at timestamptz not null default now()
);

create index if not exists phonics_bank_step_idx on public.phonics_bank (step);
create index if not exists phonics_bank_sort_order_idx on public.phonics_bank (sort_order);

alter table public.phonics_bank enable row level security;

-- word_bank 와 동일: 로그인한 사용자는 전체 읽기만, 쓰기는 SQL Editor로만 관리.
drop policy if exists phonics_bank_select on public.phonics_bank;
create policy phonics_bank_select on public.phonics_bank
  for select to authenticated using (true);
