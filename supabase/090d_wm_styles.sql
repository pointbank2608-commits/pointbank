-- 090d 활동 고르기(알아보기 → 스스로 떠올리기 사다리). 규칙 wm-v1:
--  · 도움 없이 처음 답으로 맞힌 횟수(ok_total)가 늘수록 단서를 줄인다: 그림/뜻 → 뜻→단어·듣고 고르기 → 글자 배열·빈칸 → 철자 입력 → 듣고 쓰기
--  · 최근 틀린 능력(last_skill)이 있으면 그 부분을 먼저 연습하는 활동으로 바꾼다(뜻·철자·듣기·문장·그림).
--  · 며칠 연속 틀린 낱말(miss_days ≥ 2)은 한 칸 쉬운 활동부터. 방금 쓴 활동(last_style)·이번에 이미 쓴 활동(exclude)은 뒤로 미룬다.
-- 만들 수 없는 활동(그림·예문 없음)은 호출한 쪽이 다음 후보로 넘어간다.

create or replace function public.wm_pick_styles(p_w public.wm_words, p_kind text, p_exclude text[]) returns text[]
language plpgsql stable as $$
declare
  v_lvl int := least(coalesce(p_w.ok_total, 0), 4);
  v_base text[];
  v_all text[];
  v_out text[] := '{}';
  v_s text;
begin
  if p_w.miss_days >= 2 and p_w.stage < 2 then
    v_lvl := greatest(v_lvl - 1, 0);
  end if;
  if p_kind = 'new1' then
    v_base := array['picture', 'meaning'];
  elsif p_kind = 'new2' then
    v_base := array['reverse', 'listen', 'meaning'];
  elsif p_w.last_skill is not null and p_w.miss > 0 and p_w.stage < 3 then
    v_base := case p_w.last_skill
      when 'spelling' then case when v_lvl < 3 then array['letters', 'spell'] else array['spell', 'dictation', 'letters'] end
      when 'listening' then array['listen', 'dictation']
      when 'context' then array['blank', 'reverse']
      when 'picture' then array['picture', 'meaning']
      else array['reverse', 'meaning', 'picture']
    end;
  else
    v_base := case v_lvl
      when 0 then array['picture', 'meaning']
      when 1 then array['reverse', 'listen', 'meaning']
      when 2 then array['letters', 'blank', 'listen']
      when 3 then array['spell', 'blank', 'reverse']
      else array['dictation', 'spell', 'blank']
    end;
  end if;
  -- 같은 사다리 안에서 날마다 돌려 가며(tries 로) 다른 활동을 만나게 한다
  if array_length(v_base, 1) > 1 and p_kind not in ('new1', 'new2') then
    v_base := v_base[(p_w.tries % array_length(v_base, 1)) + 1:] || v_base[1:(p_w.tries % array_length(v_base, 1))];
  end if;
  v_all := v_base || array['reverse', 'meaning', 'letters'];
  foreach v_s in array v_all loop
    if not (v_s = any(v_out)) and not (v_s = any(coalesce(p_exclude, '{}'))) and v_s is distinct from p_w.last_style then
      v_out := array_append(v_out, v_s);
    end if;
  end loop;
  foreach v_s in array v_all loop
    if not (v_s = any(v_out)) and not (v_s = any(coalesce(p_exclude, '{}'))) then
      v_out := array_append(v_out, v_s);
    end if;
  end loop;
  return v_out;
end $$;

-- 후보를 차례로 시도해 처음 만들어지는 문제를 돌려준다. 못 만들면 null.
create or replace function public.wm_first_q(p_card jsonb, p_cards jsonb, p_styles text[]) returns jsonb
language plpgsql volatile as $$
declare
  v_s text;
  v_q jsonb;
begin
  foreach v_s in array p_styles loop
    v_q := public.wm_make_q(p_card, v_s, p_cards);
    if v_q is not null then
      return v_q;
    end if;
  end loop;
  return null;
end $$;
