-- 080b: 무료 한도(반 1개·학생 10명)는 체험 중이면 풀어 준다

create or replace function public.check_free_tier_limits()
returns trigger
language plpgsql
as $$
declare
  v_plan  text;
  v_trial date;
  v_count int;
begin
  select plan, trial_ends_at into v_plan, v_trial from public.academies where id = new.academy_id;
  if v_plan is distinct from 'free' then
    return new;
  end if;
  if v_trial >= (now() at time zone 'Asia/Seoul')::date then
    return new;
  end if;

  if tg_table_name = 'classes' then
    select count(*) into v_count from public.classes where academy_id = new.academy_id;
    if v_count >= 1 then
      raise exception '무료 플랜은 반을 1개까지만 만들 수 있어요. 유료 플랜으로 업그레이드하면 반을 더 만들 수 있어요.';
    end if;
  elsif tg_table_name = 'students' then
    select count(*) into v_count from public.students where academy_id = new.academy_id;
    if v_count >= 10 then
      raise exception '무료 플랜은 학생을 10명까지만 등록할 수 있어요. 유료 플랜으로 업그레이드하면 더 등록할 수 있어요.';
    end if;
  end if;

  return new;
end;
$$;
