-- 096e 활동 고르기 확대(규칙 wm-v1 유지 + 새 방식을 사다리 칸마다 끼워 넣는다).
--  · 기존 사다리의 순서와 첫 후보는 그대로, 각 칸 뒤에 새 방식을 더해 며칠에 걸쳐 돌려 가며 만나게 한다(tries 로 회전).
--  · 선생님이 정한 집중 능력(wm_targets.focus_skill)이 있고 지금 틀린 능력(last_skill)이 없으면 그 능력을 연습하는 방식 위주로.

create or replace function public.wm_pick_styles(p_w public.wm_words, p_kind text, p_exclude text[]) returns text[]
language plpgsql stable as $$
declare
  v_lvl int := least(coalesce(p_w.ok_total, 0), 4);
  v_base text[];
  v_all text[];
  v_out text[] := '{}';
  v_s text;
  v_focus text;
begin
  select focus_skill into v_focus from public.wm_targets where id = p_w.target_id;
  if p_w.miss_days >= 2 and p_w.stage < 2 then
    v_lvl := greatest(v_lvl - 1, 0);
  end if;
  if p_kind = 'new1' then
    v_base := array['picture', 'meaning'];
  elsif p_kind = 'new2' then
    v_base := array['reverse', 'listen', 'meaning'];
  elsif p_w.last_skill is not null and p_w.miss > 0 and p_w.stage < 3 then
    v_base := case p_w.last_skill
      when 'spelling' then case when v_lvl < 3 then array['letters', 'spell', 'hint'] else array['spell', 'dictation', 'letters', 'fade'] end
      when 'listening' then array['listen', 'dictation', 'whack']
      when 'context' then array['blank', 'reverse', 'confuse']
      when 'picture' then array['picture', 'meaning', 'typepic']
      else array['reverse', 'meaning', 'picture', 'ox']
    end;
  elsif v_focus is not null then
    v_base := case v_focus
      when 'spelling' then case when v_lvl < 2 then array['copy', 'letters', 'hint'] when v_lvl < 4 then array['hint', 'letters', 'spell', 'flash'] else array['spell', 'fade', 'dictation', 'flash'] end
      when 'listening' then case when v_lvl < 2 then array['listen', 'whack', 'meaning'] else array['dictation', 'listen', 'whack'] end
      when 'context' then array['blank', 'confuse', 'reverse']
      else array['reverse', 'meaning', 'fish', 'monster', 'ox']
    end;
  else
    v_base := case v_lvl
      when 0 then array['picture', 'meaning', 'copy']
      when 1 then array['reverse', 'listen', 'meaning', 'ox', 'fish']
      when 2 then array['letters', 'blank', 'listen', 'hint', 'confuse']
      when 3 then array['spell', 'blank', 'reverse', 'typepic', 'balloon', 'flash']
      else array['dictation', 'spell', 'blank', 'fade', 'flash', 'confuse']
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
