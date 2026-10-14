-- 074: 관리자 — 학원의 기능 열기·닫기 읽고 바꾸기(조치 기록에 남는다)

create or replace function public.admin_academy_features(p_academy uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $fn$
begin
  if not public.is_platform_admin() then
    raise exception 'not_admin';
  end if;
  return jsonb_build_object(
    'group', public.academy_feature(p_academy, 'group'),
    'solo', public.academy_feature(p_academy, 'solo'),
    'homework', public.academy_feature(p_academy, 'homework')
  );
end $fn$;

create or replace function public.admin_set_academy_features(p_academy uuid, p_group boolean, p_solo boolean, p_homework boolean)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not public.is_platform_admin() then
    raise exception 'not_admin';
  end if;
  update public.academies
     set features = jsonb_build_object('group', p_group, 'solo', p_solo, 'homework', p_homework)
   where id = p_academy;
  insert into public.admin_actions (academy_id, action, detail)
  values (p_academy, 'set_features', jsonb_build_object('group', p_group, 'solo', p_solo, 'homework', p_homework));
end $fn$;

revoke all on function public.admin_academy_features(uuid) from public, anon, authenticated;
revoke all on function public.admin_set_academy_features(uuid, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.admin_academy_features(uuid) to authenticated;
grant execute on function public.admin_set_academy_features(uuid, boolean, boolean, boolean) to authenticated;
