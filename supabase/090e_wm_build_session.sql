-- 090e 하루 학습 만들기(규칙 wm-v1). 같은 날 두 번 불러도 같은 학습(유니크). 한국 날짜 기준.
--  · 하루 문항 상한: 가볍게 12 / 보통 20 (그중 일부는 틀린 낱말 다시 확인용으로 남겨 둔다: 2 / 4)
--  · 복습이 먼저: 어려운(틀린 적 있는) 낱말 → 오래 밀린 낱말 순. 복습은 본 문항의 70%까지만(밀려도 무제한으로 쌓지 않는다)
--  · 새 낱말: 공부 기간 안에서만, 하루 3개(가볍게)/5개(보통) 이하, 복습이 많으면 줄이고 70%를 넘으면 0
--  · 새 낱말은 소개 카드 → 3칸쯤 뒤 알아보기 → 더 뒤 다른 활동으로 한 번 더(같은 자리에서 정답을 보고 바로 맞힌 것은 기억 증거로 세지 않는다)

create or replace function public.wm_card(p_cards jsonb, p_key text) returns jsonb
language sql stable as $$
  select c from jsonb_array_elements(p_cards) c where c->>'key' = p_key limit 1
$$;

create or replace function public.wm_mode_params(p_mode text) returns jsonb
language sql immutable as $$
  select case p_mode when 'light' then '{"asks":12,"reserve":2,"new_max":3}'::jsonb else '{"asks":20,"reserve":4,"new_max":5}'::jsonb end
$$;

-- 낱말 하나의 복습 문제 항목(만들 수 없으면 null)
create or replace function public.wm_review_item(p_target uuid, p_key text, p_cards jsonb, p_phase text) returns jsonb
language plpgsql volatile as $$
declare
  v_w public.wm_words;
  v_card jsonb := public.wm_card(p_cards, p_key);
  v_q jsonb;
begin
  select * into v_w from public.wm_words where target_id = p_target and key = p_key;
  if v_card is null or v_w.key is null then return null; end if;
  v_q := public.wm_first_q(v_card, p_cards, public.wm_pick_styles(v_w, 'review', '{}'));
  if v_q is null then return null; end if;
  return jsonb_build_object('kind', 'ask', 'phase', p_phase, 'key', p_key, 'q', v_q);
end $$;

-- 새 낱말 한 개: 소개 카드 + 알아보기(a1) + 다른 활동(a2)
create or replace function public.wm_new_item(p_target uuid, p_key text, p_cards jsonb) returns jsonb
language plpgsql volatile as $$
declare
  v_w public.wm_words;
  v_card jsonb := public.wm_card(p_cards, p_key);
  v_q1 jsonb;
  v_q2 jsonb;
begin
  select * into v_w from public.wm_words where target_id = p_target and key = p_key;
  if v_card is null or v_w.key is null then return null; end if;
  v_q1 := public.wm_first_q(v_card, p_cards, public.wm_pick_styles(v_w, 'new1', '{}'));
  if v_q1 is null then return null; end if;
  v_q2 := public.wm_first_q(v_card, p_cards, public.wm_pick_styles(v_w, 'new2', array[v_q1->>'style']));
  return jsonb_build_object('key', p_key,
    'study', jsonb_build_object('kind', 'study', 'phase', 'new', 'key', p_key, 'word', v_card->>'word', 'meaning', v_card->>'meaning',
                                'pos', v_card->>'pos', 'imageUrl', v_card->>'imageUrl', 'example', v_card->>'example', 'speak', v_card->>'word'),
    'a1', jsonb_build_object('kind', 'ask', 'phase', 'new', 'key', p_key, 'q', v_q1),
    'a2', case when v_q2 is null then null else jsonb_build_object('kind', 'ask', 'phase', 'new', 'key', p_key, 'q', v_q2) end);
end $$;
