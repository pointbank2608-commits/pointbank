begin;
set local lock_timeout = '5s';

alter table public.homework_attempts add column short_round integer not null default 1;
create table public.homework_short_rounds (
  attempt_id uuid not null references public.homework_attempts on delete cascade,
  round_no integer not null,
  previous_key text not null unique,
  score integer not null,
  total integer not null,
  activities jsonb not null,
  answers jsonb not null,
  finished_at timestamptz not null default now(),
  primary key (attempt_id,round_no)
);
alter table public.homework_short_rounds enable row level security;
revoke all on public.homework_short_rounds from public,anon,authenticated;

-- Keep the existing teacher authorization and request digest (including the policy).
create function public.hw_assign_short(p_class uuid,p_draft jsonb,p_students uuid[],p_due timestamptz,p_request uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare policy jsonb:=p_draft->'shortRepeat'; r jsonb;
begin
  if not coalesce(jsonb_typeof(policy->'minimum')='number' and (policy->>'minimum') ~ '^[1-9][0-9]{0,2}$'
      and policy ? 'threshold' and (policy->'threshold'='null'::jsonb or
        (jsonb_typeof(policy->'threshold')='number' and (policy->>'threshold') ~ '^[0-9]{1,2}$')),false)
    then raise exception 'invalid_repeat_policy'; end if;
  if not exists(select from jsonb_array_elements(p_draft->'items') i
    where i->'config'->'block'->>'type'='recall' and jsonb_array_length(i->'content'->'questions')>0)
    then raise exception 'no_graded_questions'; end if;
  r:=public.hw_assign_draft(p_class,p_draft,p_students,p_due,p_request);
  update public.homework_assignments set settings=settings||jsonb_build_object('shortRepeat',policy)
    where id=(r->>'id')::uuid and settings->'shortRepeat' is distinct from policy;
  return r;
end $$;

alter function public.hw_state(uuid) rename to hw_state_before_short_rounds;
revoke all on function public.hw_state_before_short_rounds(uuid) from public,anon,authenticated;
create function public.hw_state(p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare s jsonb; info jsonb;
begin
  perform 1 from public.homework_attempts where token=p_token for update;
  s:=public.hw_state_before_short_rounds(p_token);
  select (a.settings->'shortRepeat')||jsonb_build_object('round',t.short_round,'lastScore',r.score,'lastTotal',r.total)
    into info from public.homework_attempts t join public.homework_assignments a on a.id=t.assignment_id
    left join public.homework_short_rounds r on r.attempt_id=t.id and r.round_no=t.short_round-1
    where t.token=p_token and a.settings ? 'shortRepeat';
  return case when info is null then s else s||jsonb_build_object('shortRepeat',info) end;
end $$;

-- The same device may have lost the transition response, or another device may have advanced.
create function public.hw_short_resume(p_token uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare current_token uuid;
begin
  select t.token into current_token from public.homework_short_rounds r join public.homework_attempts t on t.id=r.attempt_id
    where r.previous_key=md5(p_token::text);
  if current_token is not null then perform public.hw_attempt_for(current_token,true); end if;
  return current_token;
end $$;

-- Old clients must never finish a repeat assignment through the ordinary finish endpoint.
alter function public.hw_finish(uuid) rename to hw_finish_before_short_rounds;
revoke all on function public.hw_finish_before_short_rounds(uuid) from public,anon,authenticated;
create function public.hw_finish(p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if exists(select from public.homework_attempts t join public.homework_assignments a on a.id=t.assignment_id
    where t.token=p_token and t.finished_at is null and a.settings ? 'shortRepeat') then raise exception 'incomplete'; end if;
  return public.hw_finish_before_short_rounds(p_token);
end $$;

create function public.hw_short_finish(p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.homework_attempts; policy jsonb; hits integer; n integer; answered integer; next_key uuid;
begin
  select * into t from public.homework_attempts where token=p_token for update;
  if not found then
    next_key:=public.hw_short_resume(p_token);
    if next_key is null then raise exception 'not_found'; end if;
    return jsonb_build_object('next_token',next_key);
  end if;
  perform public.hw_attempt_for(p_token,true);
  select settings->'shortRepeat' into policy from public.homework_assignments where id=t.assignment_id;
  if policy is null then raise exception 'not_found'; end if;
  if t.finished_at is not null then return jsonb_build_object('score',t.score,'total',t.total); end if;
  if exists(select from public.homework_items i where i.assignment_id=t.assignment_id and not exists(
    select from public.homework_item_attempts x where x.attempt_id=t.id and x.item_id=i.id and x.finished_at is not null))
    then raise exception 'incomplete'; end if;
  select count(*),count(h.id),count(*) filter(where h.correct) into n,answered,hits
    from public.homework_items i cross join lateral jsonb_array_elements(i.content->'questions') with ordinality q(value,ord)
    left join public.homework_answers h on h.attempt_id=t.id and h.item_id=i.id and h.q_index=q.ord-1
    where i.assignment_id=t.assignment_id;
  if n=0 or answered<>n then raise exception 'incomplete'; end if;
  if t.short_round >= (policy->>'minimum')::int and
    (policy->>'threshold' is null or hits*100::bigint>n::bigint*(policy->>'threshold')::int) then
    return public.hw_finish_before_short_rounds(p_token);
  end if;
  -- Archive before opening the next round. These rows have no external references.
  -- Learning events, their delivery receipts and existing evidence links stay intact.
  insert into public.homework_short_rounds(attempt_id,round_no,previous_key,score,total,activities,answers)
    select t.id,t.short_round,md5(p_token::text),hits,n,
      (select jsonb_agg(to_jsonb(x)) from public.homework_item_attempts x where x.attempt_id=t.id),
      (select jsonb_agg(to_jsonb(h)) from public.homework_answers h where h.attempt_id=t.id);
  delete from public.homework_answers where attempt_id=t.id;
  delete from public.homework_item_attempts where attempt_id=t.id;
  update public.homework_attempts set token=gen_random_uuid(),short_round=short_round+1,last_seen_at=now()
    where id=t.id returning token into next_key;
  return jsonb_build_object('next_token',next_key);
end $$;

create function public.hw_tag_repeat_event() returns trigger language plpgsql set search_path=public as $$
declare round_no integer;
begin
  select short_round into round_no from public.homework_attempts where id=new.attempt_id;
  if round_no>1 then
    new.meta:=coalesce(new.meta,'{}'::jsonb)||jsonb_build_object('short_round',round_no);
    if new.event_type='answer' then new.event_type:='retry_answer'; end if;
  end if;
  return new;
end $$;
create trigger hw_tag_repeat_event before insert on public.learning_events for each row
  when (new.attempt_id is not null and new.event_type in ('answer','retry_answer')) execute function public.hw_tag_repeat_event();

-- Recordings submitted in an earlier round remain referenced under the original retention policy.
create or replace function public.hw_recording_cleanup_candidates() returns jsonb
language sql stable security definer set search_path=public,storage as $$
  select coalesce(jsonb_agg(o.name),'[]') from storage.objects o where o.bucket_id='homework-recordings'
  and (o.created_at < now()-interval '180 days' or (o.created_at < now()-interval '24 hours'
    and not exists(select from public.homework_item_attempts x where x.meta->>'recording'=o.name)
    and not exists(select from public.homework_short_rounds r where r.attempt_id::text=split_part(o.name,'/',1)
      and r.activities @> jsonb_build_array(jsonb_build_object('meta',jsonb_build_object('recording',o.name))))));
$$;
create or replace function public.hw_recording_access(p_path text) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare academy uuid:=public.hw_staff_academy(); cls uuid;
begin
  select a.class_id into cls from public.homework_attempts t join public.homework_assignments a on a.id=t.assignment_id
    where a.academy_id=academy and t.id::text=split_part(p_path,'/',1) and (
      exists(select from public.homework_item_attempts x where x.attempt_id=t.id and x.meta->>'recording'=p_path) or
      exists(select from public.homework_short_rounds r where r.attempt_id=t.id
        and r.activities @> jsonb_build_array(jsonb_build_object('meta',jsonb_build_object('recording',p_path)))));
  if cls is null then return false; end if;
  perform public.hw_block_academy(cls);
  return true;
end $$;

revoke all on function public.hw_assign_short(uuid,jsonb,uuid[],timestamptz,uuid), public.hw_tag_repeat_event(),
  public.hw_state(uuid),public.hw_finish(uuid),public.hw_short_finish(uuid),public.hw_short_resume(uuid) from public,anon,authenticated;
grant execute on function public.hw_assign_short(uuid,jsonb,uuid[],timestamptz,uuid) to authenticated;
grant execute on function public.hw_state(uuid),public.hw_finish(uuid),public.hw_short_finish(uuid),public.hw_short_resume(uuid) to anon,authenticated;
notify pgrst,'reload schema';
commit;
