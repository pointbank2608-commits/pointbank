-- 020. 단어 사전 확장 준비: 레벨·소분류·다중 카테고리·출처.
--
-- 사전을 교육부 800단어에서 초등 중심 약 1,500단어로 늘리기 위한 컬럼 추가. 전부 nullable/
-- 기본값 있음이라 기존 화면·게임·단어장은 그대로 동작하고, 새 컬럼은 채워진 만큼만 화면에 나온다.
-- (SQL Editor에서 실행. 여러 번 실행해도 안전하다.)
--
--  level             1~9. 지금은 초등 세부 단계 1~4만 쓰고 5 이후는 중등 이상을 위해 비워둔다.
--                    1=유치~초2, 2=초3~4, 3=초5~6, 4=초등 확장(중1 준비)
--  subcategory       "음식 > 과일" 같은 소분류. category(대표 카테고리)와 별개, 없어도 됨.
--  extra_categories  같은 뜻의 단어가 다른 카테고리에도 걸릴 때(walk: 동작+움직임) 대표
--                    카테고리 말고 추가로 걸리는 카테고리들. 뜻이 다르면 행을 나눈다(cold-1/cold-2).
--  origin            'moe'=교육부 지정 초등 필수 800단어, 'classbank'=클래스뱅크 자체 선정.
--                    화면/마케팅에서 "교육부 지정"이라고 쓸 수 있는 건 origin='moe' 뿐이다.
--
-- 숙어·표현은 별도 컬럼 없이 part_of_speech 값을 '숙어' / '표현'으로 쓴다(사전 화면의
-- "숙어·표현" 탭이 이 값으로 걸러낸다).

-- origin 기본값이 'moe'인 이유: 컬럼을 추가하는 이 시점에 이미 있는 812행은 전부 교육부
-- 지정 목록에서 온 것이라 기본값이 그대로 채워지면 된다. 새로 넣는 단어는 임포트 SQL이
-- origin='classbank'를 명시한다(그래서 이 파일을 나중에 다시 실행해도 새 단어가 'moe'로
-- 잘못 바뀌지 않는다).
alter table public.word_bank
  add column if not exists level int check (level between 1 and 9),
  add column if not exists subcategory text,
  add column if not exists extra_categories text[] not null default '{}',
  add column if not exists origin text not null default 'moe';

create index if not exists word_bank_level_idx on public.word_bank (level);
create index if not exists word_bank_subcategory_idx on public.word_bank (subcategory);
