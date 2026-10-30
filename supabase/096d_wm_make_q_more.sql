-- 096d 문제 만들기 확대: 따라 쓰기·힌트 글자·그림 쓰기·섬광 카드·점점 가리기·맞다/아니다·헷갈리는 짝·두더지·괴물·풍선·낚시 모양을 더한다.
--  090c 의 기존 8가지는 그대로. 만들 수 없으면(그림·예문·글자 수 부족) null 을 돌려 호출한 쪽이 다음 후보로 넘어간다.

-- 철자가 비슷한 오답 후보: 같은 첫 글자 → 글자 수가 비슷한 순(같은 철자·같은 뜻은 뺀다)
create or replace function public.wm_similar_words(p_cards jsonb, p_card jsonb, p_n int) returns text[]
language sql volatile as $$
  select coalesce(array_agg(v), '{}') from (
    select c->>'word' as v
      from jsonb_array_elements(p_cards) c
     where lower(c->>'word') <> lower(p_card->>'word')
       and lower(c->>'meaning') <> lower(p_card->>'meaning')
       and btrim(coalesce(c->>'word', '')) <> ''
     order by (lower(left(c->>'word', 1)) = lower(left(p_card->>'word', 1))) desc,
              (lower(left(c->>'word', 2)) = lower(left(p_card->>'word', 2))) desc,
              abs(length(c->>'word') - length(p_card->>'word')), random()
     limit p_n
  ) e
$$;

create or replace function public.wm_make_q(p_card jsonb, p_style text, p_cards jsonb) returns jsonb
language plpgsql volatile as $$
declare
  v_word text := btrim(p_card->>'word');
  v_mean text := btrim(p_card->>'meaning');
  v_pos text := coalesce(p_card->>'pos', '');
  v_img text := coalesce(p_card->>'imageUrl', '');
  v_ex text := coalesce(p_card->>'example', '');
  v_tokens text[];
  v_shuf text[];
  v_try int := 0;
begin
  case p_style
    when 'meaning' then
      return public.wm_choice_q('meaning', v_word, '', '', v_word, v_mean, public.wm_distractors(p_cards, p_card, 'meaning', 3), 'meaning');
    when 'picture' then
      if v_img = '' then return null; end if;
      return public.wm_choice_q('picture', '', '', v_img, '', v_word, public.wm_distractors(p_cards, p_card, 'word', 3), 'picture');
    when 'reverse' then
      return public.wm_choice_q('reverse', v_mean, v_pos, '', '', v_word, public.wm_distractors(p_cards, p_card, 'word', 3), 'meaning');
    when 'listen' then
      return public.wm_choice_q('listen', '', '', '', v_word, v_word, public.wm_distractors(p_cards, p_card, 'word', 3), 'listening');
    when 'letters' then
      v_tokens := case when position(' ' in v_word) > 0 then string_to_array(v_word, ' ') else regexp_split_to_array(v_word, '') end;
      if coalesce(array_length(v_tokens, 1), 0) < 3 then return null; end if;
      loop
        v_shuf := public.wm_shuffle(v_tokens);
        exit when v_shuf <> v_tokens or v_try > 8;
        v_try := v_try + 1;
      end loop;
      if v_shuf = v_tokens then return null; end if;
      return jsonb_strip_nulls(jsonb_build_object('style', 'letters', 'qtype', 'order', 'prompt', v_mean, 'sub', nullif(v_pos, ''), 'imageUrl', nullif(v_img, ''),
        'tokens', to_jsonb(v_shuf), 'correct', to_jsonb(v_tokens), 'joiner', case when position(' ' in v_word) > 0 then ' ' else '' end, 'skill', 'spelling'));
    when 'spell' then
      return jsonb_strip_nulls(jsonb_build_object('style', 'spell', 'qtype', 'text', 'prompt', v_mean, 'sub', nullif(v_pos, ''), 'imageUrl', nullif(v_img, ''), 'correct', v_word, 'skill', 'spelling'));
    when 'dictation' then
      return jsonb_build_object('style', 'listen', 'qtype', 'text', 'prompt', '', 'speak', v_word, 'correct', v_word, 'skill', 'spelling');
    when 'blank' then
      -- 예문에 낱말이 그대로(활용형 아님) 들어 있을 때만. 그렇지 않으면 빈칸·채점이 모호해진다.
      if v_ex = '' or v_ex !~* ('\m' || regexp_replace(v_word, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '\M') then return null; end if;
      return public.wm_choice_q('blank', regexp_replace(v_ex, '\m' || regexp_replace(v_word, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '\M', '_____', 'gi'), '', '', '', v_word, public.wm_distractors(p_cards, p_card, 'word', 3), 'context');
    when 'copy' then
      if v_word !~ '^[A-Za-z][A-Za-z'' -]{1,24}$' then return null; end if;
      return jsonb_strip_nulls(jsonb_build_object('style', 'copy', 'qtype', 'text', 'prompt', v_word, 'sub', v_mean, 'imageUrl', nullif(v_img, ''), 'speak', v_word, 'correct', v_word, 'skill', 'spelling'));
    when 'hint' then
      if v_word !~ '^[A-Za-z][A-Za-z'' -]{2,24}$' then return null; end if;
      return jsonb_strip_nulls(jsonb_build_object('style', 'hint', 'qtype', 'text', 'prompt', v_mean,
        'sub', (select string_agg(case when n = 1 or n = length(v_word) or ch !~ '[A-Za-z]' then ch else '_' end, ' ' order by n) from regexp_split_to_table(v_word, '') with ordinality as t(ch, n)),
        'imageUrl', nullif(v_img, ''), 'speak', v_word, 'correct', v_word, 'skill', 'spelling'));
    when 'typepic' then
      if v_img = '' or v_word !~ '^[A-Za-z][A-Za-z'' -]{1,24}$' then return null; end if;
      return jsonb_build_object('style', 'typepic', 'qtype', 'text', 'prompt', '', 'imageUrl', v_img, 'correct', v_word, 'skill', 'spelling');
    when 'flash' then
      if v_word !~ '^[A-Za-z][A-Za-z'' -]{1,24}$' then return null; end if;
      return jsonb_strip_nulls(jsonb_build_object('style', 'flash', 'qtype', 'text', 'prompt', v_word, 'sub', v_mean, 'imageUrl', nullif(v_img, ''), 'speak', v_word, 'correct', v_word, 'flashMs', 1500, 'skill', 'spelling'));
    when 'fade' then
      if v_word !~ '^[A-Za-z][A-Za-z'' -]{2,24}$' then return null; end if;
      return jsonb_strip_nulls(jsonb_build_object('style', 'fade', 'qtype', 'text', 'prompt', v_word, 'sub', v_mean, 'imageUrl', nullif(v_img, ''), 'speak', v_word, 'correct', v_word, 'skill', 'spelling'));
    when 'ox' then
      declare
        v_true boolean := random() < 0.5;
        v_other text := (public.wm_distractors(p_cards, p_card, 'meaning', 1))[1];
      begin
        if not v_true and v_other is null then v_true := true; end if;
        return jsonb_build_object('style', 'ox', 'qtype', 'choice', 'prompt', v_word || ' = ' || case when v_true then v_mean else v_other end, 'speak', v_word,
          'choices', '["O","X"]'::jsonb, 'correct', case when v_true then 0 else 1 end, 'skill', 'meaning');
      end;
    when 'confuse' then
      return public.wm_choice_q('confuse', v_mean, '', v_img, v_word, v_word, public.wm_similar_words(p_cards, p_card, 3), 'meaning');
    when 'whack' then
      return public.wm_choice_q('whack', '', '', '', v_word, v_word, public.wm_distractors(p_cards, p_card, 'word', 3), 'listening');
    when 'monster' then
      return public.wm_choice_q('monster', v_mean, v_pos, '', '', v_word, public.wm_distractors(p_cards, p_card, 'word', 3), 'meaning');
    when 'balloon' then
      return public.wm_choice_q('balloon', v_mean, '', v_img, '', v_word, public.wm_distractors(p_cards, p_card, 'word', 3), 'meaning');
    when 'fish' then
      return public.wm_choice_q('fish', v_word, '', '', v_word, v_mean, public.wm_distractors(p_cards, p_card, 'meaning', 3), 'meaning');
    else
      return null;
  end case;
end $$;
