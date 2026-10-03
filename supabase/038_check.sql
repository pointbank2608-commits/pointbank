-- 038 확인용(읽기만 함)
select id, word, pattern_marked, rule, sort_order from public.phonics_bank where step = 2 and rule = 'Short a' order by sort_order;
select id, word, meaning, image_url from public.word_bank where id = 'mat';
