-- 080d: 관리자가 체험 기간을 늘려 준다(조치 기록에 남음). 이미 끝났으면 오늘부터 센다.

create or replace function public.admin_extend_trial(p_academy_id uuid, p_days int)
returns date
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_new date;
begin
  if not public.is_platform_admin() then
    raise exception '관리자만 할 수 있어요.';
  end if;
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception '1~90일 사이로 정해 주세요.';
  end if;

  update public.academies
     set trial_ends_at = greatest(trial_ends_at, v_today) + p_days
   where id = p_academy_id
   returning trial_ends_at into v_new;

  insert into public.admin_actions (academy_id, action, detail)
  values (p_academy_id, 'extend_trial', json_build_object('days', p_days, 'until', v_new)::jsonb);

  return v_new;
end $$;

revoke execute on function public.admin_extend_trial(uuid, int) from public;
grant execute on function public.admin_extend_trial(uuid, int) to authenticated;
