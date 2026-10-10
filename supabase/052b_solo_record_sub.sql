-- 052b 개별수업 녹음: 한 단계 안에서 여러 개(역할극은 학생 대사마다) — solo_recordings 에 sub 칸을 더한다. 기존 녹음은 sub = 0 그대로.
-- 052a 를 먼저 실행한 뒤 이 파일을 실행한다.

-- ---------- 녹음: 한 단계 안에서 여러 개 ----------
alter table public.solo_recordings add column if not exists sub int not null default 0;
alter table public.solo_recordings drop constraint if exists solo_recordings_assignment_id_step_index_key;
create unique index if not exists solo_recordings_assignment_step_sub_key on public.solo_recordings (assignment_id, step_index, sub);

drop function if exists public.solo_record_save(uuid, uuid, int, text, text, numeric);
drop function if exists public.solo_record_save(uuid, uuid, int, text, text, numeric, int);
create function public.solo_record_save(p_token uuid, p_assignment uuid, p_step int, p_mime text, p_b64 text, p_seconds numeric, p_sub int default 0)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.solo_assignments;
  v_audio bytea;
begin
  v_a := public.solo_assignment_for(p_token, p_assignment);
  if not exists (select 1 from public.student_guardian where student_id = v_a.student_id and record_consent_at is not null) then
    return jsonb_build_object('error', 'no_consent');
  end if;
  v_audio := decode(p_b64, 'base64');
  if octet_length(v_audio) > 600000 or octet_length(v_audio) < 200 then
    return jsonb_build_object('error', 'bad_size');
  end if;
  delete from public.solo_recordings where created_at < now() - interval '90 days';
  insert into public.solo_recordings (assignment_id, step_index, sub, mime, seconds, audio)
  values (v_a.id, p_step, greatest(coalesce(p_sub, 0), 0), left(coalesce(p_mime, 'audio/webm'), 40), p_seconds, v_audio)
  on conflict (assignment_id, step_index, sub) do update
    set mime = excluded.mime, seconds = excluded.seconds, audio = excluded.audio, created_at = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.solo_record_list(p_assignment uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if not exists (select 1 from public.solo_assignments where id = p_assignment and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'step', r.step_index, 'sub', r.sub, 'seconds', r.seconds, 'created_at', r.created_at)
                     order by r.step_index, r.sub)
      from public.solo_recordings r where r.assignment_id = p_assignment
  ), '[]'::jsonb);
end $$;

-- 학부모 공개 쪽: 단계 종류에 따라 줄 내용을 맞춘다(노래 줄 / 지우며 말하기 문장 / 역할극의 학생 대사)
create or replace function public.solo_share_get(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_s public.solo_shares;
  v_a public.solo_assignments;
  v_l public.solo_lessons;
  v_name text;
  v_student text;
begin
  select * into v_s from public.solo_shares where token = btrim(coalesce(p_token, '')) and revoked_at is null and expires_at > now();
  if v_s.token is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into v_a from public.solo_assignments where id = v_s.assignment_id;
  select * into v_l from public.solo_lessons where id = v_a.lesson_id;
  select name into v_student from public.students where id = v_a.student_id;
  v_name := case v_s.name_mode
    when 'full' then v_student
    when 'given' then case when char_length(v_student) >= 3 and v_student ~ '^[가-힣]+$' then substr(v_student, 2) else v_student end
    else null
  end;
  return jsonb_build_object(
    'academy', (select name from public.academies where id = v_s.academy_id),
    'lesson', v_l.name,
    'student', v_name,
    'expires_at', v_s.expires_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'step', r.step_index,
               'sub', r.sub,
               'seconds', r.seconds,
               'mime', r.mime,
               'b64', encode(r.audio, 'base64'),
               'line', case st.s->>'t'
                 when 'roleplay' then jsonb_build_object('en', st.s->'lines'->r.sub->>'en', 'ko', st.s->'lines'->r.sub->>'ko')
                 when 'fadeRead' then jsonb_build_object('en', st.s->>'sentence', 'ko', st.s->>'ko')
                 else jsonb_build_object('en', st.s->>'en', 'ko', st.s->>'ko', 'videoId', st.s#>>'{clip,videoId}',
                                         'start', st.s#>'{clip,start}', 'end', st.s#>'{clip,end}')
               end
             ) order by r.step_index, r.sub)
        from public.solo_recordings r
        left join lateral (select s from jsonb_array_elements(v_l.steps) with ordinality as x(s, n) where n = r.step_index + 1) st on true
       where r.assignment_id = v_a.id
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.solo_record_save(uuid, uuid, int, text, text, numeric, int) from public, anon, authenticated;
revoke all on function public.solo_record_list(uuid) from public, anon, authenticated;
revoke all on function public.solo_share_get(text) from public, anon, authenticated;
grant execute on function public.solo_record_save(uuid, uuid, int, text, text, numeric, int) to anon, authenticated;
grant execute on function public.solo_record_list(uuid) to authenticated;
grant execute on function public.solo_share_get(text) to anon, authenticated;

-- 확인(읽기 전용): 둘 다 true
select
  exists (select 1 from information_schema.columns where table_name = 'solo_recordings' and column_name = 'sub') as sub_column,
  exists (select 1 from pg_indexes where indexname = 'solo_recordings_assignment_step_sub_key') as sub_index;
