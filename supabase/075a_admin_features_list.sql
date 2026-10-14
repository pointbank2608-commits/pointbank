-- 075: 관리자 학원 목록에서 기능 열기·닫기를 한눈에 보고 한꺼번에 바꾸기(074 위에 더한다)

create or replace function public.admin_academies_features()
returns table (academy_id uuid, grp boolean, solo boolean, homework boolean)
language plpgsql stable security definer set search_path = public
as $fn$
begin
  if not public.is_platform_admin() then
    raise exception 'not_admin';
  end if;
  return query
    select a.id,
           public.academy_feature(a.id, 'group'),
           public.academy_feature(a.id, 'solo'),
           public.academy_feature(a.id, 'homework')
      from public.academies a;
end $fn$;

-- p_except 학원(내 학원)을 뺀 모든 학원의 개별수업·숙제를 한꺼번에 열거나 닫는다(단체수업 칸은 그대로 둔다)
create or replace function public.admin_set_features_bulk(p_solo boolean, p_homework boolean, p_except uuid default null)
returns integer
language plpgsql security definer set search_path = public
as $fn$
declare
  v_n integer;
begin
  if not public.is_platform_admin() then
    raise exception 'not_admin';
  end if;
  update public.academies a
     set features = jsonb_build_object(
           'group', public.academy_feature(a.id, 'group'),
           'solo', p_solo,
           'homework', p_homework)
   where p_except is null or a.id <> p_except;
  get diagnostics v_n = row_count;
  insert into public.admin_actions (action, detail)
  values ('set_features_bulk', jsonb_build_object('solo', p_solo, 'homework', p_homework, 'except', p_except, 'count', v_n));
  return v_n;
end $fn$;

revoke all on function public.admin_academies_features() from public, anon, authenticated;
revoke all on function public.admin_set_features_bulk(boolean, boolean, uuid) from public, anon, authenticated;
grant execute on function public.admin_academies_features() to authenticated;
grant execute on function public.admin_set_features_bulk(boolean, boolean, uuid) to authenticated;
