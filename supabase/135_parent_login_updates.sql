-- Parent login, attendance, approved feedback and homework reminders. Requires 133/134.
begin;

alter table public.parent_accounts add column login_key bytea;
create function public.parent_login_key(p_name text,p_phone text) returns bytea
language sql stable security definer set search_path = pg_catalog, public as $$
  select extensions.hmac(public.sp_name_key(p_name)||':'||public.sp_phone_digits(p_phone),
    value,'sha256') from public.private_config where key='guardian_phone_key';
$$;
create function public.parent_account_login_key() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare contact jsonb;
begin
  select convert_from(extensions.pgp_sym_decrypt_bytea(new.contact_enc,value),'UTF8')::jsonb
    into contact from public.private_config where key='guardian_phone_key';
  new.login_key := public.parent_login_key(contact->>'name',contact->>'phone');
  return new;
end $$;
create trigger parent_account_login_key before insert or update of contact_enc on public.parent_accounts
  for each row execute function public.parent_account_login_key();
update public.parent_accounts set contact_enc=contact_enc;
alter table public.parent_accounts alter column login_key set not null;
create index parent_accounts_login_idx on public.parent_accounts(login_key);

create table public.parent_login_failures (
  fail_key bytea not null,
  failed_at timestamptz not null default now()
);
create index parent_login_failures_key_idx on public.parent_login_failures(fail_key,failed_at);
alter table public.parent_login_failures enable row level security;
revoke all on public.parent_login_failures from public,anon,authenticated;

create function public.parent_login(p_name text,p_phone text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare name_key text:=public.sp_name_key(p_name); digits text:=public.sp_phone_digits(p_phone);
  identity_key bytea; failure_key bytea; matches uuid[]; sid uuid;
  secret text; session_id uuid; result jsonb:='[]';
begin
  if coalesce(length(name_key),0) not between 1 and 80 or coalesce(length(digits),0) not between 10 and 11 then
    return jsonb_build_object('error','bad_login');
  end if;
  identity_key:=public.parent_login_key(name_key,digits);
  failure_key:=public.parent_login_key(name_key,'');
  perform pg_advisory_xact_lock(hashtextextended(encode(failure_key,'hex'),0));
  if (select count(*) from public.parent_login_failures
      where fail_key=failure_key and failed_at>now()-interval '10 minutes')>=8 then
    return jsonb_build_object('error','locked');
  end if;
  select array(select a.student_id from public.parent_accounts a
    join public.students s on s.id=a.student_id
    where a.login_key=identity_key and s.archived_at is null order by a.student_id limit 51) into matches;
  if cardinality(matches)=0 or cardinality(matches)>50 then
    insert into public.parent_login_failures(fail_key) values(failure_key);
    return jsonb_build_object('error','bad_login');
  end if;
  foreach sid in array matches loop
    perform 1 from public.students where id=sid and archived_at is null for no key update;
    if not found or not exists(select 1 from public.parent_accounts where student_id=sid and login_key=identity_key) then
      continue;
    end if;
    delete from public.parent_sessions where id in (
      select id from public.parent_sessions where student_id=sid order by created_at desc,id offset 9
    );
    secret:=encode(extensions.gen_random_bytes(32),'hex');
    insert into public.parent_sessions(student_id,secret_hash)
      values(sid,extensions.digest(secret,'sha256')) returning id into session_id;
    result:=result||jsonb_build_array(jsonb_build_object('id',session_id,'token',secret,'student_id',sid));
  end loop;
  if result='[]'::jsonb then return jsonb_build_object('error','bad_login'); end if;
  return jsonb_build_object('sessions',result);
end $$;

-- Timestamped check-in and a teacher's date-only presence mark have different meanings.
alter table public.attendance add column check_in_kind text not null default 'unknown'
  check(check_in_kind in ('unknown','time','day'));
create table public.parent_feedback (
  id uuid primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 2000),
  published_at timestamptz not null default now(),
  published_by uuid
);
alter table public.parent_feedback enable row level security;
revoke all on public.parent_feedback from public,anon,authenticated;

create function public.parent_publish_feedback(p_student uuid,p_body text,p_request uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare prior public.parent_feedback; body text:=btrim(p_body);
begin
  perform public.parent_staff_student(p_student);
  if not exists(select 1 from public.parent_accounts where student_id=p_student) then
    raise exception 'parent_account_required';
  end if;
  if p_request is null or coalesce(char_length(body),0) not between 1 and 2000 then raise exception 'bad_feedback'; end if;
  select * into prior from public.parent_feedback where id=p_request;
  if found then
    if prior.student_id<>p_student or prior.body<>body then raise exception 'request_conflict'; end if;
    return prior.id;
  end if;
  insert into public.parent_feedback(id,student_id,body,published_by) values(p_request,p_student,body,auth.uid());
  return p_request;
end $$;

create table public.parent_updates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  source text not null check(source in ('attendance','feedback','word_day')),
  source_id uuid not null,
  kind text not null check(kind in ('attendance','checkout','attendance_changed','feedback','daily_completed')),
  happened_at timestamptz not null default now(),
  details jsonb not null default '{}'
);
create index parent_updates_student_idx on public.parent_updates(student_id,happened_at desc);
alter table public.parent_updates enable row level security;
revoke all on public.parent_updates from public,anon,authenticated;
alter table public.parent_push_devices add column registered_at timestamptz not null default now();
alter table public.parent_push_queue drop constraint parent_push_queue_event_check;
alter table public.parent_push_queue add constraint parent_push_queue_event_check
  check(event in ('published','completed','overdue','attendance','checkout','attendance_changed','feedback',
    'daily_completed','homework_checked','homework_missing'));

create view public.parent_notice_rows as
  select h.student_id,h.source,h.assignment_id,'published'::text as kind,h.published_at as happened_at,
    h.title,null::text as body,'{}'::jsonb as details from public.parent_homework_rows h
  union all
  select h.student_id,h.source,h.assignment_id,'completed',h.completed_at,h.title,null,'{}'
    from public.parent_homework_rows h where h.completed_at is not null
  union all
  select h.student_id,h.source,h.assignment_id,'overdue',h.due_at,h.title,null,'{}'
    from public.parent_homework_rows h where h.status='overdue'
  union all
  select t.student_id,'checked_homework',t.id,
    case when t.delta>0 then 'homework_checked' else 'homework_missing' end,
    t.created_at,''::text,null::text,'{}'::jsonb
    from public.transactions t join public.students s on s.id=t.student_id and s.academy_id=t.academy_id
    where t.is_homework and s.archived_at is null
  union all
  select u.student_id,u.source,u.id,u.kind,u.happened_at,
    case when u.source='word_day' then p.title else '' end,
    case when u.source='feedback' then f.body end,u.details
    from public.parent_updates u join public.students s on s.id=u.student_id and s.archived_at is null
    left join public.attendance a on u.source='attendance' and a.id=u.source_id and a.student_id=s.id and a.academy_id=s.academy_id
    left join public.parent_feedback f on u.source='feedback' and f.id=u.source_id and f.student_id=s.id
    left join public.wm_sessions w on u.source='word_day' and w.id=u.source_id
    left join public.wm_targets t on t.id=w.target_id and t.student_id=s.id
    left join public.wm_plans p on p.id=t.plan_id and p.academy_id=s.academy_id
    where (u.source='attendance' and (
        (u.kind='attendance' and a.checked_in_at is not null)
        or (u.kind='checkout' and a.checked_out_at is not null)
        or u.kind='attendance_changed'))
      or (u.source='feedback' and f.id is not null)
      or (u.source='word_day' and p.id is not null and w.done_at is not null
        and public.academy_feature(p.academy_id,'homework'));
revoke all on public.parent_notice_rows from public,anon,authenticated;

create function public.parent_queue_update() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  insert into public.parent_push_queue(device_id,source,assignment_id,event)
    select d.id,new.source,new.id,new.kind from public.parent_push_devices d
    join public.parent_sessions p on p.id=d.session_id
    join public.students s on s.id=p.student_id
    where p.student_id=new.student_id and p.expires_at>now() and s.archived_at is null
      and exists(select 1 from public.parent_notice_rows n where n.source=new.source and n.assignment_id=new.id)
    on conflict do nothing;
  return new;
end $$;
create trigger parent_update_published after insert on public.parent_updates
  for each row execute function public.parent_queue_update();

create function public.parent_attendance_update() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare kind text;
begin
  if tg_op='DELETE' then
    insert into public.parent_updates(student_id,source,source_id,kind,details)
      select old.student_id,'attendance',old.id,'attendance_changed',jsonb_build_object('day',old.attended_on)
      from public.students where id=old.student_id and academy_id=old.academy_id and archived_at is null;
    return old;
  end if;
  if not exists(select 1 from public.students where id=new.student_id and academy_id=new.academy_id and archived_at is null) then return new; end if;
  if tg_op='INSERT' then
    if new.checked_in_at is not null then kind:='attendance';
    elsif new.checked_out_at is not null then kind:='checkout'; else return new; end if;
  else
    if new.checked_in_at is not distinct from old.checked_in_at
      and new.checked_out_at is not distinct from old.checked_out_at
      and new.check_in_kind=old.check_in_kind then return new; end if;
    kind:='attendance_changed';
    if old.checked_in_at is null and new.checked_in_at is not null then kind:='attendance'; end if;
    if old.checked_out_at is null and new.checked_out_at is not null then kind:='checkout'; end if;
  end if;
  insert into public.parent_updates(student_id,source,source_id,kind,details)
    values(new.student_id,'attendance',new.id,kind,jsonb_build_object('day',new.attended_on,
      'check_in_kind',new.check_in_kind));
  return new;
end $$;
create trigger parent_attendance_update after insert or update of checked_in_at,checked_out_at,check_in_kind
  on public.attendance for each row execute function public.parent_attendance_update();
create trigger parent_attendance_delete after delete on public.attendance
  for each row execute function public.parent_attendance_update();
create function public.parent_feedback_update() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  insert into public.parent_updates(student_id,source,source_id,kind)
    values(new.student_id,'feedback',new.id,'feedback');
  return new;
end $$;
create trigger parent_feedback_update after insert on public.parent_feedback
  for each row execute function public.parent_feedback_update();

create function public.parent_word_day_update() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if new.done_at is null then return new; end if;
  if tg_op='UPDATE' and old.done_at is not null then return new; end if;
  insert into public.parent_updates(student_id,source,source_id,kind,details)
    select t.student_id,'word_day',new.id,'daily_completed',jsonb_build_object('day',new.day)
      from public.wm_targets t join public.wm_plans p on p.id=t.plan_id
      join public.students s on s.id=t.student_id and s.academy_id=p.academy_id and s.archived_at is null
      where t.id=new.target_id and public.academy_feature(p.academy_id,'homework');
  return new;
end $$;
create trigger parent_word_day_update after insert or update of done_at on public.wm_sessions
  for each row execute function public.parent_word_day_update();

create function public.parent_checked_homework_update() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if not new.is_homework then return new; end if;
  insert into public.parent_push_queue(device_id,source,assignment_id,event)
    select d.id,n.source,n.assignment_id,n.kind from public.parent_push_devices d
    join public.parent_sessions p on p.id=d.session_id
    join public.parent_notice_rows n on n.student_id=p.student_id and n.source='checked_homework' and n.assignment_id=new.id
    where p.expires_at>now()
    on conflict do nothing;
  return new;
end $$;
create trigger parent_checked_homework_update after insert on public.transactions
  for each row execute function public.parent_checked_homework_update();

alter function public.parent_home(text,text) rename to parent_home_v133;
revoke all on function public.parent_home_v133(text,text) from public,anon,authenticated;
create function public.parent_home(p_token text,p_endpoint text default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare p public.parent_sessions:=public.parent_resolve(p_token); result jsonb;
begin
  result:=public.parent_home_v133(p_token,p_endpoint);
  if p.id is null then return result; end if;
  return result||jsonb_build_object(
    'homework',coalesce((select jsonb_agg(
      case when h->>'source'='words' then h||jsonb_build_object('daily',(
        select jsonb_build_object('day',public.wm_today(),'started',w.id is not null,'completed_at',w.done_at)
        from public.wm_targets t join public.wm_plans plan on plan.id=t.plan_id
        left join public.wm_sessions w on w.target_id=t.id and w.day=public.wm_today()
        where t.id=(h->>'assignment_id')::uuid and t.student_id=p.student_id and plan.start_date<=public.wm_today()
      )) else h end) from jsonb_array_elements(result->'homework') h),'[]'::jsonb),
    'notices',coalesce((select jsonb_agg(to_jsonb(n)-'student_id' order by n.happened_at desc,n.assignment_id)
      from (select * from public.parent_notice_rows where student_id=p.student_id
        and happened_at between now()-interval '90 days' and statement_timestamp()
        order by happened_at desc,assignment_id limit 200) n),'[]'::jsonb),
    'attendance',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'day',a.attended_on,
      'present',a.checked_in_at is not null,'check_in_kind',a.check_in_kind,
      'checked_in_at',case when a.check_in_kind='time' then a.checked_in_at end,
      'checked_out_at',a.checked_out_at) order by a.attended_on desc)
      from public.attendance a join public.students s on s.id=a.student_id and s.academy_id=a.academy_id
      where a.student_id=p.student_id and a.attended_on between (now() at time zone 'Asia/Seoul')::date-90
        and (now() at time zone 'Asia/Seoul')::date),'[]'::jsonb));
end $$;
revoke all on function public.parent_home(text,text) from public,anon,authenticated;
grant execute on function public.parent_home(text,text) to anon,authenticated;

create or replace function public.parent_claim_push() returns table(id uuid,session_id uuid,tries integer,
  endpoint text,p256dh text,auth_key text,lang text,event text)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  delete from public.parent_login_failures where failed_at<now()-interval '1 day';
  delete from public.parent_invites where expires_at<=now();
  delete from public.parent_sessions p where p.expires_at<=now()
    or exists(select 1 from public.students s where s.id=p.student_id and s.archived_at is not null);
  delete from public.parent_push_queue where created_at<now()-interval '7 days';
  -- A clock tick, not a client visit, detects missing completion after a deadline.
  insert into public.parent_push_queue(device_id,source,assignment_id,event)
    select d.id,n.source,n.assignment_id,n.kind from public.parent_push_devices d
    join public.parent_sessions p on p.id=d.session_id
    join public.parent_notice_rows n on n.student_id=p.student_id and n.kind='overdue'
    where n.happened_at>=d.registered_at and n.happened_at>=now()-interval '1 day'
      and p.expires_at>now()
    on conflict do nothing;
  return query with batch as (
    select q.id from public.parent_push_queue q join public.parent_push_devices d on d.id=q.device_id
    join public.parent_sessions p on p.id=d.session_id
    where not q.done and q.tries<5 and q.next_at<=now() and q.created_at>=now()-interval '1 day'
      and exists(select 1 from public.parent_notice_rows n where n.student_id=p.student_id
        and n.source=q.source and n.assignment_id=q.assignment_id and n.kind=q.event)
    order by q.next_at,q.created_at,q.id limit 25 for update of q skip locked
  ), claimed as (
    update public.parent_push_queue q set tries=q.tries+1,next_at=now()+interval '2 minutes'*power(2,q.tries)
      from batch b where q.id=b.id returning q.*
  ) select c.id,d.session_id,c.tries,d.endpoint,d.p256dh,d.auth_key,d.lang,c.event
    from claimed c join public.parent_push_devices d on d.id=c.device_id;
end $$;

revoke all on function public.parent_login_key(text,text),public.parent_account_login_key(),public.parent_login(text,text),
  public.parent_publish_feedback(uuid,text,uuid),public.parent_queue_update(),public.parent_attendance_update(),
  public.parent_feedback_update(),public.parent_word_day_update(),public.parent_checked_homework_update() from public,anon,authenticated;
grant execute on function public.parent_login(text,text) to anon,authenticated;
grant execute on function public.parent_publish_feedback(uuid,text,uuid) to authenticated;
commit;
