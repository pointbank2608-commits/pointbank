-- 083c: 지금 보이는 학원들(최대 100곳)의 기능 열기·닫기만 읽는다

create or replace function public.admin_academies_features_for(p_ids uuid[])
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
      from public.academies a
     where a.id = any(p_ids[1:100]);
end $fn$;

revoke all on function public.admin_academies_features_for(uuid[]) from public, anon;
grant execute on function public.admin_academies_features_for(uuid[]) to authenticated;
