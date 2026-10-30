-- 094a: 숙제 블록 검증에 "영상 반복 보기"(watch) 블록을 더한다. 087 의 hw_validate_items 를 그대로 두고 watch 만 허용한다.
-- watch 는 완료 조건 watch 만, 시청 횟수(views) 1~5, 정답 있는 문제는 없다.

create or replace function public.hw_validate_items(p_items jsonb, p_draft boolean default false) returns void
language plpgsql immutable set search_path = public as $$
declare i jsonb; b jsonb; q jsonb; c jsonb; v text; n int;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or octet_length(p_items::text) > 1000000 then raise exception 'bad_items'; end if;
  if jsonb_array_length(p_items) > 60 or (not p_draft and jsonb_array_length(p_items) = 0) then raise exception 'no_items'; end if;
  for i in select value from jsonb_array_elements(p_items) loop
    if coalesce(i->>'kind','') not in ('quiz','worksheet','game','shadowing') or jsonb_typeof(i->'config') is distinct from 'object' or jsonb_typeof(i->'content'->'questions') is distinct from 'array' then raise exception 'bad_item'; end if;
    b := i->'config'->'block';
    if b is not null then
      if b->>'schemaVersion' is distinct from '1' or coalesce(b->>'type','') not in ('study','recall','speak','sentence','video','watch') then raise exception 'unsupported_block'; end if;
      if coalesce(b->>'completion','') not in ('confirm','answers','recording','review','watch') then raise exception 'bad_completion'; end if;
      if (b->>'type' = 'study' and b->>'completion' <> 'confirm') or (b->>'type' = 'recall' and b->>'completion' <> 'answers') or (b->>'type' = 'speak' and b->>'completion' <> 'recording') or (b->>'type' = 'sentence' and b->>'completion' not in ('answers','review')) or (b->>'type' = 'video' and b->>'completion' not in ('watch','review','recording')) or (b->>'type' = 'watch' and b->>'completion' <> 'watch') then raise exception 'bad_completion'; end if;
      foreach v in array array['text','translation','question','imageUrl','audioUrl','videoUrl'] loop
        if jsonb_typeof(b->v) is distinct from 'string' or length(b->>v) > 5000 then raise exception 'bad_content'; end if;
      end loop;
      foreach v in array array['imageUrl','audioUrl'] loop
        if coalesce(b->>v,'') <> '' and (b->>v !~ '^(https://|/[^/])') then raise exception 'bad_media_url'; end if;
      end loop;
      if jsonb_typeof(b->'stages') is distinct from 'array' or jsonb_typeof(b->'hiddenWords') is distinct from 'array' or jsonb_array_length(b->'hiddenWords') > 500 then raise exception 'bad_stages'; end if;
      if coalesce(b->>'repeats','') !~ '^[1-5]$' then raise exception 'bad_repeats'; end if;
      if b->>'type' = 'watch' and coalesce(b->>'views','') !~ '^[1-5]$' then raise exception 'bad_views'; end if;
      if exists(select 1 from jsonb_array_elements_text(b->'stages') s where s not in ('model','hidden','picture')) or jsonb_array_length(b->'stages') > 3 then raise exception 'bad_stages'; end if;
      if exists(select 1 from jsonb_array_elements_text(b->'hiddenWords') h where h !~ '^[0-9]{1,3}$') then raise exception 'bad_mask'; end if;
      if not p_draft then
        if b->>'type' not in ('video','recall','watch') and length(trim(b->>'text')) = 0 then raise exception 'missing_content'; end if;
        if b->>'type' = 'speak' and jsonb_array_length(b->'stages') = 0 then raise exception 'bad_stages'; end if;
        if b->>'type' in ('video','watch') and (b->>'videoUrl' !~ '(youtube\.com/(watch\?v=|embed/|shorts/)|youtu\.be/)[A-Za-z0-9_-]{11}' and b->>'videoUrl' !~ '^[A-Za-z0-9_-]{11}$') then raise exception 'bad_video'; end if;
        if b->>'type' = 'video' then
          if jsonb_typeof(b->'start') is distinct from 'number' or jsonb_typeof(b->'end') is distinct from 'number' then raise exception 'bad_segment'; end if;
          if (b->>'start')::numeric < 0 or (b->>'end')::numeric <= (b->>'start')::numeric or (b->>'end')::numeric - (b->>'start')::numeric > 1200 then raise exception 'bad_segment'; end if;
        end if;
      end if;
      if b->>'completion' <> 'answers' and jsonb_array_length(i->'content'->'questions') <> 0 then raise exception 'ungraded_has_questions'; end if;
    end if;
    n := jsonb_array_length(i->'content'->'questions');
    if n > 200 then raise exception 'too_many_questions'; end if;
    if not p_draft and n = 0 and coalesce(b->>'completion','answers') = 'answers' and i->>'kind' <> 'shadowing' then raise exception 'no_questions'; end if;
    if not p_draft then
      for q in select value from jsonb_array_elements(i->'content'->'questions') loop
        if coalesce(q->>'qtype','') not in ('choice','text','order') then raise exception 'bad_question'; end if;
        if length(coalesce(q->>'prompt','')) > 5000 or q->'correct' is null or q->'correct' = 'null'::jsonb then raise exception 'bad_question'; end if;
        if q->>'style'='listen' and length(trim(coalesce(q->>'speak','')))=0 then raise exception 'missing_audio_text'; end if;
        if q->>'style'='picture' and length(trim(coalesce(q->>'imageUrl','')))=0 then raise exception 'missing_picture'; end if;
        if q->>'qtype' = 'choice' then
          c := q->'choices';
          if jsonb_typeof(c) is distinct from 'array' or jsonb_array_length(c) < 2 or jsonb_array_length(c) > 10 or q->>'correct' !~ '^[0-9]$' then raise exception 'bad_choices'; end if;
          if (q->>'correct')::int >= jsonb_array_length(c) or exists (select 1 from jsonb_array_elements(c) x where jsonb_typeof(x) <> 'string' or length(trim(x #>> '{}')) = 0) then raise exception 'bad_choices'; end if;
          if (select count(distinct x) from jsonb_array_elements(c) x) <> jsonb_array_length(c) then raise exception 'duplicate_choices'; end if;
          if q->>'style' = 'meaning' and exists(select 1 from jsonb_array_elements_text(c) x where length(x) > 45 or x ~ E'[\n\r→=]' or x ~* '(문법|예문|주의|규칙|설명|동사원형|주어|목적어|과거형|현재형|접속사|분사구문|grammar[ :]|note:|example:)') then raise exception 'meaning_contains_notes'; end if;
        elsif q->>'qtype' = 'text' then
          if jsonb_typeof(q->'correct') <> 'string' or length(trim(q->>'correct')) = 0 or length(q->>'correct')>300 then raise exception 'bad_answer'; end if;
        else
          if jsonb_typeof(q->'correct') <> 'array' or jsonb_typeof(q->'tokens') <> 'array' or jsonb_array_length(q->'correct') = 0 then raise exception 'bad_order'; end if;
          if length((q->'correct')::text)>300 or exists(select 1 from jsonb_array_elements_text(q->'correct') part where length(trim(part))=0) then raise exception 'bad_order'; end if;
        end if;
      end loop;
    end if;
  end loop;
end $$;
