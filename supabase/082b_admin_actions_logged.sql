-- 082b: 플랜 변경·학원 삭제를 서버 함수 안에서 조치 기록(admin_actions)에 남긴다.
-- (예전에는 화면이 따로 기록해서 목록 화면의 변경은 빠지고, 기록이 실패해도 무시됐다.)

create or replace function public.admin_set_academy_plan(p_academy_id uuid, p_plan text, p_until date default null)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception '관리자만 할 수 있어요.';
  end if;
  if p_plan not in ('free', 'paid') then
    raise exception 'plan은 free 또는 paid여야 해요.';
  end if;

  update public.academies
  set plan                 = p_plan,
      plan_status           = 'active',
      plan_started_at       = case when p_plan = 'paid' then now() else plan_started_at end,
      next_billing_at       = null,
      billing_failure_count = 0,
      plan_expires_at       = case when p_plan = 'paid' then p_until else null end
  where id = p_academy_id;

  insert into public.admin_actions (academy_id, action, detail)
  values (p_academy_id, case when p_plan = 'paid' then 'set_paid' else 'set_free' end,
          json_build_object('until', p_until)::jsonb);
end;
$$;

create or replace function public.admin_delete_academy(p_academy_id uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_name text;
begin
  if not public.is_platform_admin() then
    raise exception '관리자만 할 수 있어요.';
  end if;

  select name into v_name from public.academies where id = p_academy_id;
  if v_name is null then
    raise exception '학원을 찾을 수 없어요.';
  end if;

  delete from public.academies where id = p_academy_id;

  insert into public.admin_actions (action, detail)
  values ('delete_academy', json_build_object('name', v_name, 'academy_id', p_academy_id)::jsonb);
end;
$$;

revoke execute on function public.admin_delete_academy(uuid) from public, anon;
grant execute on function public.admin_delete_academy(uuid) to authenticated;
