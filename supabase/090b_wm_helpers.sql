-- 090b 단어암기숙제 도우미: 한국 날짜·낱말 열쇠·정규화·채점. (테스트는 app.wm_now 로 시각을 바꾼다 — 운영 클라이언트는 설정할 수 없다)

create or replace function public.wm_now() returns timestamptz
language sql stable as $$
  select coalesce(nullif(current_setting('app.wm_now', true), '')::timestamptz, now())
$$;

create or replace function public.wm_today() returns date
language sql stable as $$
  select (public.wm_now() at time zone 'Asia/Seoul')::date
$$;

-- 같은 철자라도 뜻이 다르면 다른 열쇠(낱말|뜻, 소문자·공백 정리)
create or replace function public.wm_key(p_word text, p_meaning text) returns text
language sql immutable as $$
  select lower(regexp_replace(btrim(coalesce(p_word, '')), '\s+', ' ', 'g')) || '|' || lower(regexp_replace(btrim(coalesce(p_meaning, '')), '\s+', ' ', 'g'))
$$;

create or replace function public.wm_norm(p text) returns text
language sql immutable as $$
  select lower(regexp_replace(regexp_replace(btrim(coalesce(p, '')), '[.!?]+$', ''), '\s+', ' ', 'g'))
$$;

-- 서버 채점: choice(보기 번호) · text(철자, '/'로 여러 답) · order(조각 순서 JSON 배열)
create or replace function public.wm_grade(q jsonb, r text) returns boolean
language plpgsql immutable as $$
declare
  v text;
begin
  if r is null then
    return false;
  end if;
  case coalesce(q->>'qtype', 'choice')
    when 'choice' then
      return r ~ '^\d+$' and q->>'correct' is not null and r::int = (q->>'correct')::int;
    when 'text' then
      foreach v in array string_to_array(coalesce(q->>'correct', ''), '/') loop
        if public.wm_norm(v) <> '' and public.wm_norm(v) = public.wm_norm(r) then
          return true;
        end if;
      end loop;
      return false;
    when 'order' then
      begin
        return (r::jsonb) = (q->'correct');
      exception when others then
        return false;
      end;
    else
      return false;
  end case;
end $$;

-- 학생에게 보여 줄 정답 글(채점한 뒤에만)
create or replace function public.wm_answer_text(q jsonb) returns text
language sql immutable as $$
  select case coalesce(q->>'qtype', 'choice')
    when 'choice' then q->'choices'->>((q->>'correct')::int)
    when 'text' then split_part(q->>'correct', '/', 1)
    when 'order' then (select string_agg(x, coalesce(q->>'joiner', ' ')) from jsonb_array_elements_text(q->'correct') as x)
  end
$$;

create or replace function public.wm_shuffle(p text[]) returns text[]
language sql volatile as $$
  select coalesce(array_agg(x order by random()), '{}') from unnest(p) as x
$$;
