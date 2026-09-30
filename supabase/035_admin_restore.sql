-- 035. 관리자가 학원 자료를 백업하고, 이전 시점(날짜·시간)으로 되돌린다 — 2026-09-30
--
-- 034 의 content_revisions 위에 얹는다. 관리자는 선생님 계정에 들어가지 않고,
-- 지워진 수업·단어장·게임 내용도 같은 id 로 되살릴 수 있다.
--
-- 실행: 034 를 먼저 Run 한 뒤, 이 파일을 SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전하다.

alter table public.content_revisions drop constraint if exists content_revisions_op_check;
alter table public.content_revisions add constraint content_revisions_op_check
  check (op in ('update', 'delete', 'backup'));

-- ---------- 지금 상태를 백업으로 남기기 ----------
create or replace function public.admin_snapshot_academy(p_academy_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  if not public.is_platform_admin() then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;
  if not exists (select 1 from public.academies where id = p_academy_id) then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.content_revisions (academy_id, table_name, row_id, op, class_id, name, data)
  select l.academy_id, 'curriculum_lessons', l.id, 'backup', l.class_id, l.name, to_jsonb(l)
    from public.curriculum_lessons l where l.academy_id = p_academy_id;
  get diagnostics n = row_count;

  insert into public.content_revisions (academy_id, table_name, row_id, op, class_id, name, data)
  select w.academy_id, 'word_lists', w.id, 'backup', w.class_id, w.name, to_jsonb(w)
    from public.word_lists w where w.academy_id = p_academy_id;

  insert into public.content_revisions (academy_id, table_name, row_id, op, class_id, name, data)
  select g.academy_id, 'game_templates', g.id, 'backup', g.class_id, g.name, to_jsonb(g)
    from public.game_templates g where g.academy_id = p_academy_id;

  insert into public.admin_actions (academy_id, action, detail)
  values (p_academy_id, 'backup_content', json_build_object('lessons', n)::jsonb);

  return json_build_object('ok', true, 'lessons', n);
end;
$$;
revoke all on function public.admin_snapshot_academy(uuid) from public, anon;
grant execute on function public.admin_snapshot_academy(uuid) to authenticated;

-- ---------- 한 기록을 그 시점 내용으로 되돌리기(없으면 다시 넣기) ----------
create or replace function public.admin_restore_revision(p_revision_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.content_revisions;
  v_class uuid;
  v_wl uuid;
  v_by uuid;
  v_exists boolean;
begin
  if not public.is_platform_admin() then
    return json_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into r from public.content_revisions where id = p_revision_id;
  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  v_class := null;
  if r.data ? 'class_id' and r.data ->> 'class_id' is not null
     and exists (select 1 from public.classes where id = (r.data ->> 'class_id')::uuid) then
    v_class := (r.data ->> 'class_id')::uuid;
  end if;

  v_by := null;
  if r.data ? 'created_by' and r.data ->> 'created_by' is not null
     and exists (select 1 from auth.users where id = (r.data ->> 'created_by')::uuid) then
    v_by := (r.data ->> 'created_by')::uuid;
  end if;

  if r.table_name = 'curriculum_lessons' then
    v_wl := null;
    if r.data ? 'word_list_id' and r.data ->> 'word_list_id' is not null
       and exists (select 1 from public.word_lists where id = (r.data ->> 'word_list_id')::uuid) then
      v_wl := (r.data ->> 'word_list_id')::uuid;
    end if;
    select exists(select 1 from public.curriculum_lessons where id = r.row_id) into v_exists;
    if v_exists then
      update public.curriculum_lessons set
        class_id = v_class,
        name = coalesce(r.data ->> 'name', name),
        word_list_id = v_wl,
        video_url = r.data ->> 'video_url',
        level = r.data ->> 'level',
        playlist = coalesce(r.data -> 'playlist', playlist),
        updated_at = now()
      where id = r.row_id;
    else
      insert into public.curriculum_lessons
        (id, academy_id, class_id, name, word_list_id, video_url, level, playlist, created_by, created_at, updated_at)
      values (
        r.row_id, r.academy_id, v_class, coalesce(r.data ->> 'name', '(되살린 수업)'),
        v_wl, r.data ->> 'video_url', r.data ->> 'level',
        coalesce(r.data -> 'playlist', '[]'::jsonb), v_by,
        coalesce((r.data ->> 'created_at')::timestamptz, now()), now()
      );
    end if;

  elsif r.table_name = 'word_lists' then
    select exists(select 1 from public.word_lists where id = r.row_id) into v_exists;
    if v_exists then
      update public.word_lists set
        class_id = v_class,
        name = coalesce(r.data ->> 'name', name),
        items = coalesce(r.data -> 'items', items),
        updated_at = now()
      where id = r.row_id;
    else
      insert into public.word_lists (id, academy_id, class_id, name, items, created_by, created_at, updated_at)
      values (
        r.row_id, r.academy_id, v_class, coalesce(r.data ->> 'name', '(되살린 단어장)'),
        coalesce(r.data -> 'items', '[]'::jsonb), v_by,
        coalesce((r.data ->> 'created_at')::timestamptz, now()), now()
      );
    end if;

  elsif r.table_name = 'game_templates' then
    select exists(select 1 from public.game_templates where id = r.row_id) into v_exists;
    if v_exists then
      update public.game_templates set
        class_id = v_class,
        name = coalesce(r.data ->> 'name', name),
        game_type = coalesce(r.data ->> 'game_type', game_type),
        items = coalesce(r.data -> 'items', items),
        config = coalesce(r.data -> 'config', config),
        updated_at = now()
      where id = r.row_id;
    else
      insert into public.game_templates
        (id, academy_id, class_id, game_type, name, items, config, created_by, created_at, updated_at)
      values (
        r.row_id, r.academy_id, v_class,
        coalesce(r.data ->> 'game_type', 'wheel'),
        coalesce(r.data ->> 'name', '(되살린 게임)'),
        coalesce(r.data -> 'items', '[]'::jsonb),
        coalesce(r.data -> 'config', '{}'::jsonb),
        v_by, coalesce((r.data ->> 'created_at')::timestamptz, now()), now()
      );
    end if;
  else
    return json_build_object('ok', false, 'error', 'unknown_table');
  end if;

  insert into public.admin_actions (academy_id, action, detail)
  values (
    r.academy_id,
    'restore_content',
    json_build_object(
      'revision_id', r.id,
      'table_name', r.table_name,
      'row_id', r.row_id,
      'name', r.name,
      'op', r.op,
      'when', r.created_at,
      'was_missing', not v_exists
    )::jsonb
  );

  return json_build_object(
    'ok', true,
    'table_name', r.table_name,
    'name', r.name,
    'when', r.created_at,
    'recreated', not v_exists
  );
end;
$$;
revoke all on function public.admin_restore_revision(uuid) from public, anon;
grant execute on function public.admin_restore_revision(uuid) to authenticated;

-- 자료 보기에 "지금 있는지 / 슬라이드·단어 수" 를 붙여, 관리자가 되돌릴 시점을 고르게 한다.
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
               (select name from public.classes where id = r.class_id) as class_name,
               case when r.table_name = 'curriculum_lessons'
                    then jsonb_array_length(coalesce(r.data -> 'playlist', '[]'::jsonb))
                    when r.table_name = 'word_lists'
                    then jsonb_array_length(coalesce(r.data -> 'items', '[]'::jsonb))
                    else jsonb_array_length(coalesce(r.data -> 'items', '[]'::jsonb))
               end as item_count,
               case when r.table_name = 'curriculum_lessons'
                    then jsonb_array_length(coalesce(r.data -> 'playlist', '[]'::jsonb))
                    else null
               end as slide_count,
               case when r.table_name = 'curriculum_lessons'
                    then exists (select 1 from public.curriculum_lessons x where x.id = r.row_id)
                    when r.table_name = 'word_lists'
                    then exists (select 1 from public.word_lists x where x.id = r.row_id)
                    else exists (select 1 from public.game_templates x where x.id = r.row_id)
               end as row_exists
          from public.content_revisions r where r.academy_id = p_academy_id
         order by r.created_at desc limit 120) x)
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_academy_content(uuid) from public, anon;
grant execute on function public.admin_academy_content(uuid) to authenticated;
