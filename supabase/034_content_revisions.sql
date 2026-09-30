-- 034. 선생님 자료 기록(되돌리기·백업) + 관리자 "학원 자료 보기"(읽기 전용) — 2026-09-30
--
-- 계기: 반마다 복사한 수업이 서로 같이 바뀌고, 슬라이드가 사라졌다는 선생님 제보. 서버에 이전 버전이 없어
-- 되살릴 수 없었고, 운영자도 계정 정보 없이는 그 학원 자료를 확인할 방법이 없었다.
--
--  1) content_revisions: 수업(curriculum_lessons)·단어장(word_lists)·게임 내용(game_templates)을 고치거나
--     지우기 "직전" 내용을 트리거가 자동으로 남긴다(앱이 어떤 경로로 고쳐도 빠짐없이).
--     - 고치기: 같은 자료를 10분 안에 여러 번 고치면 첫 번째 직전 내용만 남긴다(타자 칠 때마다 쌓이지 않게),
--       자료마다 최근 30개까지.
--     - 지우기: 지운 순간의 내용을 남긴다(180일 보관) → "지운 수업 되살리기".
--     - 학원 사람(선생님)은 자기 학원 기록만 읽는다. 쓰기는 트리거만(정책 없음).
--  2) admin_academy_content(학원 id): 관리자 전용, 그 학원의 수업·단어장·게임 내용과 서로의 연결(반 전용/학원 공용,
--     같이 쓰는 수업 수)과 최근 기록을 돌려준다. 볼 때마다 admin_actions 에 'view_content' 로 남긴다.
--
-- 실행: Supabase SQL Editor 에 통째로 붙여 넣고 Run. 여러 번 실행해도 안전하다.

-- ---------- 1) 자료 기록 ----------
create table if not exists public.content_revisions (
  id          uuid primary key default gen_random_uuid(),
  academy_id  uuid not null references public.academies(id) on delete cascade,
  table_name  text not null check (table_name in ('curriculum_lessons', 'word_lists', 'game_templates')),
  row_id      uuid not null,
  op          text not null check (op in ('update', 'delete')),
  class_id    uuid,
  name        text,
  data        jsonb not null,
  changed_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists content_revisions_row_idx on public.content_revisions (table_name, row_id, created_at desc);
create index if not exists content_revisions_academy_idx on public.content_revisions (academy_id, created_at desc);

alter table public.content_revisions enable row level security;
drop policy if exists content_revisions_select on public.content_revisions;
create policy content_revisions_select on public.content_revisions
  for select using ((academy_id = public.my_academy_id() and public.is_staff()) or public.is_platform_admin());

create or replace function public.capture_content_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 학원 자체를 지우는 중(연쇄 삭제)이면 기록하지 않는다(기록도 함께 지워질 것이라 남길 곳이 없다)
  if not exists (select 1 from public.academies where id = old.academy_id) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    -- 내용이 실제로 바뀐 때만(updated_at 만 바뀐 건 무시)
    if (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
      return new;
    end if;
    -- 10분 안에 이미 남긴 기록이 있으면 건너뜀(그 기록이 "이번에 고치기 시작하기 전" 내용)
    if exists (
      select 1 from public.content_revisions
       where table_name = tg_table_name and row_id = old.id and op = 'update'
         and created_at > now() - interval '10 minutes'
    ) then
      return new;
    end if;
  end if;

  insert into public.content_revisions (academy_id, table_name, row_id, op, class_id, name, data)
  values (old.academy_id, tg_table_name, old.id, lower(tg_op), old.class_id, old.name, to_jsonb(old));

  -- 보관 한도: 자료마다 고치기 기록 30개, 지운 기록은 180일
  delete from public.content_revisions r
   where r.table_name = tg_table_name and r.row_id = old.id and r.op = 'update'
     and r.id not in (
       select id from public.content_revisions
        where table_name = tg_table_name and row_id = old.id and op = 'update'
        order by created_at desc limit 30);
  if tg_op = 'DELETE' then
    delete from public.content_revisions
     where academy_id = old.academy_id and op = 'delete' and created_at < now() - interval '180 days';
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists curriculum_lessons_revision on public.curriculum_lessons;
create trigger curriculum_lessons_revision before update or delete on public.curriculum_lessons
  for each row execute function public.capture_content_revision();
drop trigger if exists word_lists_revision on public.word_lists;
create trigger word_lists_revision before update or delete on public.word_lists
  for each row execute function public.capture_content_revision();
drop trigger if exists game_templates_revision on public.game_templates;
create trigger game_templates_revision before update or delete on public.game_templates
  for each row execute function public.capture_content_revision();

-- ---------- 2) 관리자: 학원 자료 보기(읽기 전용) ----------
create or replace function public.admin_academy_content(p_academy_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_platform_admin() then
    return null;
  end if;

  insert into public.admin_actions (academy_id, action, detail)
  values (p_academy_id, 'view_content', null);

  with lesson_games as (
    select l.id as lesson_id, (s ->> 'templateId')::uuid as template_id
      from public.curriculum_lessons l,
           jsonb_array_elements(coalesce(l.playlist, '[]'::jsonb)) s
     where l.academy_id = p_academy_id and s ->> 'kind' = 'game' and coalesce(s ->> 'templateId', '') <> ''
  )
  select json_build_object(
    'classes', (select coalesce(json_agg(json_build_object('id', c.id, 'name', c.name) order by c.name), '[]'::json)
                  from public.classes c where c.academy_id = p_academy_id),
    'lessons', (select coalesce(json_agg(x order by x.class_name nulls first, x.name), '[]'::json) from (
        select l.id, l.name, l.class_id,
               (select name from public.classes where id = l.class_id) as class_name,
               jsonb_array_length(coalesce(l.playlist, '[]'::jsonb)) as slide_count,
               (select string_agg(s ->> 'kind', ',') from jsonb_array_elements(coalesce(l.playlist, '[]'::jsonb)) s) as slide_kinds,
               l.word_list_id,
               (select name from public.word_lists where id = l.word_list_id) as word_list_name,
               (select class_id is null from public.word_lists where id = l.word_list_id) as word_list_shared,
               (select count(*) from public.curriculum_lessons l2 where l2.word_list_id = l.word_list_id and l.word_list_id is not null)::int as word_list_used_by,
               (select coalesce(json_agg(json_build_object(
                         'id', g.id, 'name', g.name, 'game_type', g.game_type, 'shared', g.class_id is null,
                         'used_by', (select count(distinct lg2.lesson_id) from lesson_games lg2 where lg2.template_id = g.id))), '[]'::json)
                  from public.game_templates g where g.id in (select template_id from lesson_games where lesson_id = l.id)) as games,
               (select count(*) from public.content_revisions r where r.table_name = 'curriculum_lessons' and r.row_id = l.id)::int as revisions,
               l.created_at, l.updated_at
          from public.curriculum_lessons l
         where l.academy_id = p_academy_id) x),
    'word_lists', (select coalesce(json_agg(x order by x.name), '[]'::json) from (
        select w.id, w.name, w.class_id, (select name from public.classes where id = w.class_id) as class_name,
               jsonb_array_length(coalesce(w.items, '[]'::jsonb)) as item_count,
               (select count(*) from public.curriculum_lessons l where l.word_list_id = w.id)::int as used_by,
               w.updated_at
          from public.word_lists w where w.academy_id = p_academy_id) x),
    'recent_revisions', (select coalesce(json_agg(x order by x.created_at desc), '[]'::json) from (
        select r.id, r.table_name, r.row_id, r.op, r.name, r.class_id, r.created_at,
               case when r.table_name = 'curriculum_lessons'
                    then jsonb_array_length(coalesce(r.data -> 'playlist', '[]'::jsonb)) end as slide_count
          from public.content_revisions r where r.academy_id = p_academy_id
         order by r.created_at desc limit 50) x)
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_academy_content(uuid) from public, anon;
grant execute on function public.admin_academy_content(uuid) to authenticated;
