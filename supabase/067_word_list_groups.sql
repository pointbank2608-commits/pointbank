-- 067: 내 단어장 그룹(폴더). 단어장이 많아졌을 때 이름 붙인 그룹으로 묶어 접어 둔다.
-- group_name 이 null 이면 그룹 없음. 같은 학원 안에서 이름이 같으면 같은 그룹이다.
alter table public.word_lists add column if not exists group_name text;
create index if not exists word_lists_group_idx on public.word_lists (academy_id, group_name);

select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'word_lists' and column_name = 'group_name') as has_group_col;
