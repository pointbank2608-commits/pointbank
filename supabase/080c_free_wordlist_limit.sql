-- 080c: 체험이 끝난 무료 학원은 단어장 1개(10단어까지)만 만들고 고칠 수 있다.
-- 더 만들어 둔 단어장은 지워지지 않고 읽기 전용(게임에서 불러오기는 계속 됨)으로 남는다.

create or replace function public.check_free_wordlist_limit()
returns trigger
language plpgsql
as $$
declare
  v_plan  text;
  v_trial date;
  v_count int;
begin
  select plan, trial_ends_at into v_plan, v_trial from public.academies where id = new.academy_id;
  if v_plan is distinct from 'free' or v_trial >= (now() at time zone 'Asia/Seoul')::date then
    return new;
  end if;

  if jsonb_array_length(coalesce(new.items, '[]'::jsonb)) > 10 then
    raise exception '무료 플랜의 단어장은 단어를 10개까지만 담을 수 있어요. 유료 플랜으로 업그레이드하면 제한이 없어요.';
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_count from public.word_lists where academy_id = new.academy_id;
    if v_count >= 1 then
      raise exception '무료 플랜은 단어장을 1개까지만 만들 수 있어요. 유료 플랜으로 업그레이드하면 단어장을 마음껏 만들 수 있어요.';
    end if;
  else
    if exists (
      select 1 from public.word_lists w
       where w.academy_id = new.academy_id
         and (w.created_at < old.created_at or (w.created_at = old.created_at and w.id < old.id))
    ) then
      raise exception '무료 플랜에서는 가장 먼저 만든 단어장 1개만 고칠 수 있어요. 이 단어장은 읽기 전용이에요.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists word_lists_free_cap on public.word_lists;
create trigger word_lists_free_cap
  before insert or update of items, name on public.word_lists
  for each row execute function public.check_free_wordlist_limit();
