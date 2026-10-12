-- 066: 내 단어장에 "문장 목록" 종류를 더한다.
--   kind = 'word'     : 단어장(기존, 단어 + 뜻) — 단어 게임이 쓴다
--   kind = 'sentence' : 문장 목록(영어 문장 + 해석) — 문장 배열하기 같은 문장 게임이 쓴다
-- 같은 word_lists 표를 쓰고(항목 모양 word/meaning 은 그대로: word = 영어 문장, meaning = 해석),
-- 앱은 kind 가 없으면(이 SQL 전) 모두 단어장으로 읽는다. 기존 행은 모두 'word'.

alter table public.word_lists add column if not exists kind text not null default 'word';
alter table public.word_lists drop constraint if exists word_lists_kind_check;
alter table public.word_lists add constraint word_lists_kind_check check (kind in ('word', 'sentence'));

-- 확인: 위 칸이 있고 기존 단어장이 모두 'word' 인지
select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'word_lists' and column_name = 'kind') as has_kind_col,
  (select count(*) from public.word_lists where kind = 'word') as word_lists,
  (select count(*) from public.word_lists where kind = 'sentence') as sentence_lists;
