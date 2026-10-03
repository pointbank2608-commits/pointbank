-- 038. 파닉스 2단계 Short a 에 -ad 낱말(dad·sad·mad)을 더하고, 사전에 없던 mat 을 넣는다(2026-10-03 사용자 요청).
-- 여러 번 실행해도 안전하다(이미 있으면 아무것도 안 한다).
-- 그림: dad·sad·mad 는 사전 그림을 파닉스 그림 폴더에 복사했고, mat 은 파닉스 그림을 사전 그림 폴더에 복사했다.

-- -ad 낱말이 Short a 끝(yam 다음)에 오도록 뒤 순서를 3칸 민다 — dad-s2 가 아직 없을 때만.
do $$
begin
  if not exists (select 1 from public.phonics_bank where id = 'dad-s2') then
    update public.phonics_bank
    set sort_order = sort_order + 3
    where sort_order > (select sort_order from public.phonics_bank where id = 'yam-s2');

    insert into public.phonics_bank (id, word, pattern_marked, step, rule, meaning, image_url, sort_order)
    select v.id, v.word, v.pattern, 2, 'Short a', v.meaning, '/phonics-images/' || v.word || '.webp', y.sort_order + v.n
    from (values
      ('dad-s2', 'dad', 'd{a}d', '아빠', 1),
      ('sad-s2', 'sad', 's{a}d', '슬픈', 2),
      ('mad-s2', 'mad', 'm{a}d', '화난', 3)
    ) as v(id, word, pattern, meaning, n)
    cross join (select sort_order from public.phonics_bank where id = 'yam-s2') as y;
  end if;
end $$;

-- 사전에 mat(매트) 넣기
insert into public.word_bank
  (id, word, sense_number, part_of_speech, meaning, example_sentence, category, extra_categories, subcategory, level, origin, image_url, image_kind, sort_order)
values
  ('mat', 'mat', 1, '명사', '매트, 깔개', 'The cat is on the mat.', '집/가구', '{}', '거실', 1, 'classbank', '/word-bank-images/mat.webp', 'object', 5954)
on conflict (id) do nothing;
