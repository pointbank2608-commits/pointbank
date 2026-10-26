-- 090c 문제 만들기: 단어 카드 하나 + 활동 모양 → 정답 포함 문제(jsonb). 만들 수 없으면 null(그림·예문이 없을 때 등).
-- 스타일: meaning(영→뜻) picture(그림→단어) reverse(뜻→단어) listen(듣고 단어) letters(글자 배열) spell(철자 입력) dictation(듣고 쓰기) blank(문장 빈칸)

-- 오답 후보: 같은 철자·같은 뜻은 뺀다(정답이 둘이 되는 보기를 막는다). field = 'word' | 'meaning'
create or replace function public.wm_distractors(p_cards jsonb, p_card jsonb, p_field text, p_n int) returns text[]
language sql volatile as $$
  select coalesce(array_agg(v), '{}') from (
    select v from (
      select distinct on (lower(c->>p_field)) c->>p_field as v
        from jsonb_array_elements(p_cards) c
       where lower(c->>'word') <> lower(p_card->>'word')
         and lower(c->>'meaning') <> lower(p_card->>'meaning')
         and btrim(coalesce(c->>p_field, '')) <> ''
       order by lower(c->>p_field), random()
    ) d
    order by random()
    limit p_n
  ) e
$$;

create or replace function public.wm_choice_q(p_style text, p_prompt text, p_sub text, p_img text, p_speak text, p_right text, p_wrong text[], p_skill text) returns jsonb
language plpgsql volatile as $$
declare
  v_all text[];
begin
  if coalesce(array_length(p_wrong, 1), 0) < 1 then
    return null;
  end if;
  v_all := public.wm_shuffle(array_append(p_wrong[1:3], p_right));
  return jsonb_strip_nulls(jsonb_build_object(
    'style', p_style, 'qtype', 'choice', 'prompt', p_prompt, 'sub', nullif(p_sub, ''), 'imageUrl', nullif(p_img, ''), 'speak', nullif(p_speak, ''),
    'choices', to_jsonb(v_all), 'correct', array_position(v_all, p_right) - 1, 'skill', p_skill));
end $$;

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
    else
      return null;
  end case;
end $$;
