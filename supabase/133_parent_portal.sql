-- Parent access is separate from student login. Run after the homework/solo/grammar/WM migrations.
begin;

create table public.parent_accounts (
  student_id uuid primary key references public.students(id) on delete cascade,
  contact_enc bytea not null,
  phone_last4 text not null,
  consent_at timestamptz not null default now(),
  consent_by uuid
);
create table public.parent_invites (
  student_id uuid primary key references public.parent_accounts(student_id) on delete cascade,
  secret_hash bytea not null unique,
  expires_at timestamptz not null
);
create table public.parent_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.parent_accounts(student_id) on delete cascade,
  secret_hash bytea not null unique,
  created_at timestamptz not null default now(),
  read_through timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days')
);
create index parent_sessions_student_idx on public.parent_sessions(student_id);
create index parent_sessions_expiry_idx on public.parent_sessions(expires_at);
create table public.parent_push_devices (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.parent_sessions(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  lang text not null check (lang in ('ko', 'en')),
  unique (session_id, endpoint)
);
create table public.parent_push_queue (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.parent_push_devices(id) on delete cascade,
  source text not null,
  assignment_id uuid not null,
  event text not null check (event in ('published', 'completed')),
  created_at timestamptz not null default now(),
  next_at timestamptz not null default now(),
  tries integer not null default 0,
  done boolean not null default false,
  unique (device_id, source, assignment_id, event)
);
create index parent_push_queue_due_idx on public.parent_push_queue(next_at) where not done;
create index parent_push_queue_created_idx on public.parent_push_queue(created_at);

alter table public.parent_accounts enable row level security;
alter table public.parent_invites enable row level security;
alter table public.parent_sessions enable row level security;
alter table public.parent_push_devices enable row level security;
alter table public.parent_push_queue enable row level security;
revoke all on public.parent_accounts, public.parent_invites, public.parent_sessions, public.parent_push_devices, public.parent_push_queue
  from public, anon, authenticated;

-- Existing server state is authoritative. The word project has no one-time
-- assignment completion; finishing a daily session does not finish the project.
create view public.parent_homework_rows as
  select 'online'::text as source, h.id as assignment_id, t.student_id, h.title,
    t.created_at as published_at, h.due_at, a.finished_at as completed_at,
    case when a.finished_at is not null then 'completed'
         when h.closed_at is not null then 'closed'
         when h.due_at < now() then 'overdue'
         when t.token_expires_at < now() then 'closed'
         when a.started_at is not null then 'started' else 'pending' end as status
  from public.homework_assignment_targets t
  join public.homework_assignments h on h.id = t.assignment_id
  join public.students s on s.id = t.student_id and s.academy_id = h.academy_id
  left join public.homework_attempts a on a.assignment_id = h.id and a.student_id = s.id
  where public.academy_feature(h.academy_id, 'homework')
  union all
  select 'solo', a.id, a.student_id, l.name, a.assigned_at, a.due_at, a.finished_at,
    case when a.finished_at is not null then 'completed'
         when a.due_at < now() then 'overdue'
         when a.started_at is not null or a.progress > 0 then 'started' else 'pending' end
  from public.solo_assignments a
  join public.solo_lessons l on l.id = a.lesson_id and l.academy_id = a.academy_id
  join public.students s on s.id = a.student_id and s.academy_id = a.academy_id
  where a.kind = 'homework' and public.academy_feature(a.academy_id, 'solo')
  union all
  select 'grammar', a.id, a.student_id, c.content->>'title', p.approved_at, p.initial_due_at, a.finished_at,
    case when a.finished_at is not null then 'completed'
         when a.initial_completed_at is not null then 'review'
         when p.initial_due_at < now() then 'overdue'
         when a.run_id is not null then 'started' else 'pending' end
  from public.grammar_assignments a
  join public.grammar_plans p on p.id = a.plan_id
  join public.grammar_content_versions c on c.goal_id = p.goal_id and c.version = p.version
  join public.students s on s.id = a.student_id and s.academy_id = p.academy_id
  where p.mode = 'homework' and a.revoked_at is null and public.grammar_feature_open(p.academy_id, p.mode)
  union all
  select 'words', t.id, t.student_id, p.title, t.created_at, null, null,
    case when p.closed_at is not null or public.wm_today() >= p.start_date + p.study_days + p.review_days
         then 'closed' else 'untracked' end
  from public.wm_targets t
  join public.wm_plans p on p.id = t.plan_id
  join public.students s on s.id = t.student_id and s.academy_id = p.academy_id
  where public.academy_feature(p.academy_id, 'homework');
revoke all on public.parent_homework_rows from public, anon, authenticated;

create function public.parent_staff_student(p_student uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not coalesce(public.is_staff(), false) then raise exception 'not_found'; end if;
  -- Serialize invite issuance, redemption and revocation for this student.
  perform 1 from public.students
  where id = p_student and academy_id = public.my_academy_id() and archived_at is null
  for no key update;
  if not found then raise exception 'not_found'; end if;
end $$;

create function public.parent_account_status(p_student uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare k text;
begin
  perform public.parent_staff_student(p_student);
  select value into k from public.private_config where key = 'guardian_phone_key';
  return (
    select jsonb_build_object(
      'name', (convert_from(extensions.pgp_sym_decrypt_bytea(contact_enc,k),'UTF8')::jsonb)->>'name',
      'last4',phone_last4
    )
    from public.parent_accounts where student_id = p_student
  );
end $$;

create function public.parent_save_account(p_student uuid,p_name text,p_phone text,p_consent boolean) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare k text; prior bytea; contact jsonb; guardian_name text := btrim(p_name); digits text := public.sp_phone_digits(p_phone);
begin
  perform public.parent_staff_student(p_student);
  if not coalesce(p_consent,false) then raise exception 'consent_required'; end if;
  if coalesce(char_length(guardian_name),0) not between 1 and 80 then raise exception 'bad_name'; end if;
  if coalesce(char_length(digits),0) not between 10 and 11 then raise exception 'bad_phone'; end if;
  select value into strict k from public.private_config where key = 'guardian_phone_key';
  select contact_enc into prior from public.parent_accounts where student_id = p_student;
  contact := jsonb_build_object('name',guardian_name,'phone',digits);
  if prior is not null then
    if convert_from(extensions.pgp_sym_decrypt_bytea(prior,k),'UTF8')::jsonb = contact then return; end if;
    delete from public.parent_invites where student_id = p_student;
    delete from public.parent_sessions where student_id = p_student;
  end if;
  insert into public.parent_accounts (student_id,contact_enc,phone_last4,consent_by)
  values (p_student,extensions.pgp_sym_encrypt_bytea(convert_to(contact::text,'UTF8'),k),right(digits,4),auth.uid())
  on conflict (student_id) do update set contact_enc = excluded.contact_enc, phone_last4 = excluded.phone_last4,
    consent_at = excluded.consent_at, consent_by = excluded.consent_by;
end $$;

create function public.parent_remove_account(p_student uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.parent_staff_student(p_student);
  delete from public.parent_accounts where student_id = p_student;
end $$;

create function public.parent_make_invite(p_student uuid) returns text
language plpgsql security definer set search_path = pg_catalog, public as $$
declare secret text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  perform public.parent_staff_student(p_student);
  if not exists(select 1 from public.parent_accounts where student_id = p_student) then
    raise exception 'parent_account_required';
  end if;
  insert into public.parent_invites values (p_student, extensions.digest(secret,'sha256'), now() + interval '7 days')
    on conflict (student_id) do update set secret_hash = excluded.secret_hash, expires_at = excluded.expires_at;
  return secret;
end $$;

create function public.parent_disconnect(p_student uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.parent_staff_student(p_student);
  delete from public.parent_invites where student_id = p_student;
  delete from public.parent_sessions where student_id = p_student;
end $$;

create function public.parent_connect(p_invite text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare h bytea; sid uuid; secret text; session_id uuid;
begin
  if p_invite is null or p_invite !~ '^[0-9a-f]{64}$' then return jsonb_build_object('error','invalid_invite'); end if;
  h := extensions.digest(p_invite,'sha256');
  select student_id into sid from public.parent_invites where secret_hash = h and expires_at > now();
  perform 1 from public.students where id = sid and archived_at is null for no key update;
  if not found then return jsonb_build_object('error','invalid_invite'); end if;
  delete from public.parent_invites where student_id = sid and secret_hash = h and expires_at > now();
  if not found then return jsonb_build_object('error','invalid_invite'); end if;
  -- Limit retained device access; leaving previous devices connected is intentional.
  delete from public.parent_sessions where id in (
    select id from public.parent_sessions where student_id = sid order by created_at desc, id offset 9
  );
  secret := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.parent_sessions (student_id, secret_hash)
    values (sid, extensions.digest(secret,'sha256')) returning id into session_id;
  return jsonb_build_object('token', secret, 'id', session_id, 'student_id', sid);
end $$;

create function public.parent_resolve(p_token text) returns public.parent_sessions
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare result public.parent_sessions;
begin
  if p_token ~ '^[0-9a-f]{64}$' then
    select p.* into result from public.parent_sessions p join public.students s on s.id = p.student_id
    where p.secret_hash = extensions.digest(p_token,'sha256') and p.expires_at > now() and s.archived_at is null;
  end if;
  return result;
end $$;

create function public.parent_home(p_token text, p_endpoint text default null) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare p public.parent_sessions := public.parent_resolve(p_token);
begin
  if p.id is null then return jsonb_build_object('error','expired'); end if;
  return (
    select jsonb_build_object('name',s.name,'academy',a.name,'read_through',p.read_through,
      'push_key',(select value from public.private_config where key = 'parent_push_public_key'),
      'snapshot',statement_timestamp(),'push_enabled',exists(
        select 1 from public.parent_push_devices where session_id = p.id and endpoint = p_endpoint
      ),'homework',coalesce((
        select jsonb_agg(to_jsonb(r) - 'student_id' order by
          greatest(r.published_at, r.completed_at) desc, r.assignment_id)
        from (
          select * from public.parent_homework_rows v where v.student_id = p.student_id
            and v.published_at <= statement_timestamp()
            and (greatest(v.published_at,v.completed_at) >= now() - interval '90 days'
              or v.status in ('pending','started','review','untracked'))
          order by greatest(v.published_at, v.completed_at) desc, v.assignment_id limit 100
        ) r
      ),'[]'::jsonb))
    from public.students s join public.academies a on a.id = s.academy_id where s.id = p.student_id
  );
end $$;

create function public.parent_read(p_token text, p_through timestamptz) returns void
language sql security definer set search_path = pg_catalog, public as $$
  update public.parent_sessions set read_through = greatest(read_through, least(now(),p_through))
  where p_through is not null and id = (public.parent_resolve(p_token)).id;
$$;

create function public.parent_logout(p_token text) returns void
language sql security definer set search_path = pg_catalog, public as $$
  delete from public.parent_sessions
  where p_token ~ '^[0-9a-f]{64}$' and secret_hash = extensions.digest(p_token,'sha256');
$$;

create function public.parent_set_push(p_token text, p_endpoint text, p_enabled boolean,
  p_p256dh text default null, p_auth text default null, p_lang text default 'ko') returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare pid uuid := (public.parent_resolve(p_token)).id;
begin
  perform 1 from public.parent_sessions where id = pid for update;
  if not found then return jsonb_build_object('error','expired'); end if;
  if coalesce(p_enabled,false) = false then
    delete from public.parent_push_devices where session_id = pid and endpoint = p_endpoint;
    return jsonb_build_object('enabled', false);
  end if;
  -- Push endpoints are remote destinations. Accept only the supported browser push services.
  if coalesce(length(p_endpoint),0) not between 1 and 2048 or
     p_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[A-Za-z0-9_./:~%?=&+-]+$'
     or coalesce(p_p256dh,'') !~ '^[A-Za-z0-9_-]{87}$'
     or coalesce(p_auth,'') !~ '^[A-Za-z0-9_-]{22}$' then
    return jsonb_build_object('error','bad_subscription');
  end if;
  insert into public.parent_push_devices (session_id,endpoint,p256dh,auth_key,lang)
    values (pid,p_endpoint,p_p256dh,p_auth,case when p_lang='en' then 'en' else 'ko' end)
  on conflict (session_id,endpoint) do update set p256dh=excluded.p256dh, auth_key=excluded.auth_key, lang=excluded.lang;
  delete from public.parent_push_devices d where d.session_id = pid and d.endpoint <> p_endpoint;
  return jsonb_build_object('enabled', true);
end $$;

-- Server-side transitions only. No new activity sensor or client-reported completion.
create function public.parent_queue_event() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare src text := tg_argv[0]; evt text := tg_argv[1]; row_id uuid; sid uuid := new.student_id;
begin
  if evt = 'completed' then
    if new.finished_at is null then return new; end if;
    if tg_op = 'UPDATE' and old.finished_at is not null then return new; end if;
  elsif tg_op = 'UPDATE' then
    if new.kind <> 'homework' or old.kind = 'homework' then return new; end if;
  end if;
  if src = 'online' then row_id := new.assignment_id; else row_id := new.id; end if;
  insert into public.parent_push_queue(device_id,source,assignment_id,event)
  select d.id,src,row_id,evt
  from public.parent_sessions p
  join public.parent_push_devices d on d.session_id = p.id
  join public.students s on s.id = p.student_id
  where p.student_id = sid and p.expires_at > now() and s.archived_at is null
    and exists (select 1 from public.parent_homework_rows v where v.student_id = sid and v.source = src
      and v.assignment_id = row_id and (evt <> 'published' or v.status <> 'closed'))
  on conflict (device_id,source,assignment_id,event) do nothing;
  return new;
end $$;

create trigger parent_online_published after insert on public.homework_assignment_targets
  for each row execute function public.parent_queue_event('online','published');
create trigger parent_online_completed after insert or update of finished_at on public.homework_attempts
  for each row execute function public.parent_queue_event('online','completed');
create trigger parent_solo_published after insert or update of kind on public.solo_assignments
  for each row execute function public.parent_queue_event('solo','published');
create trigger parent_solo_completed after insert or update of finished_at on public.solo_assignments
  for each row execute function public.parent_queue_event('solo','completed');
create trigger parent_grammar_published after insert on public.grammar_assignments
  for each row execute function public.parent_queue_event('grammar','published');
create trigger parent_grammar_completed after insert or update of finished_at on public.grammar_assignments
  for each row execute function public.parent_queue_event('grammar','completed');
create trigger parent_words_published after insert on public.wm_targets
  for each row execute function public.parent_queue_event('words','published');

create function public.parent_claim_push() returns table(id uuid, session_id uuid, tries integer,
  endpoint text, p256dh text, auth_key text, lang text, event text)
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  delete from public.parent_invites where expires_at <= now();
  delete from public.parent_sessions p where p.expires_at <= now()
    or exists (select 1 from public.students s where s.id = p.student_id and s.archived_at is not null);
  delete from public.parent_push_queue where created_at < now() - interval '7 days';
  return query
  with batch as (
    select q.id from public.parent_push_queue q join public.parent_push_devices d on d.id = q.device_id
    join public.parent_sessions p on p.id = d.session_id
    where not q.done and q.tries < 5 and q.next_at <= now() and q.created_at >= now() - interval '1 day'
      and exists (select 1 from public.parent_homework_rows v where v.student_id = p.student_id and v.source = q.source
        and v.assignment_id = q.assignment_id
        and (case when q.event = 'completed' then v.completed_at is not null else v.status <> 'closed' end))
    order by q.next_at, q.created_at, q.id limit 25 for update of q skip locked
  ), claimed as (
    update public.parent_push_queue q set tries = q.tries+1,
      next_at = now() + (interval '2 minutes' * power(2,q.tries))
    from batch b where q.id = b.id returning q.*
  )
  select c.id,d.session_id,c.tries,d.endpoint,d.p256dh,d.auth_key,d.lang,c.event
    from claimed c join public.parent_push_devices d on d.id = c.device_id;
end $$;

create function public.parent_finish_push(p_id uuid,p_try int,p_result text) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if p_result = 'gone' then
    delete from public.parent_push_devices d using public.parent_push_queue q
      where q.id = p_id and q.tries = p_try and q.device_id = d.id;
  elsif p_result in ('sent','discard') then
    update public.parent_push_queue set done = true where id = p_id and tries = p_try;
  end if;
end $$;

revoke all on function public.parent_staff_student(uuid), public.parent_make_invite(uuid), public.parent_disconnect(uuid),
  public.parent_account_status(uuid), public.parent_save_account(uuid,text,text,boolean), public.parent_remove_account(uuid),
  public.parent_connect(text), public.parent_resolve(text), public.parent_home(text,text), public.parent_read(text,timestamptz),
  public.parent_logout(text), public.parent_set_push(text,text,boolean,text,text,text), public.parent_queue_event(),
  public.parent_claim_push(), public.parent_finish_push(uuid,int,text) from public, anon, authenticated;
grant execute on function public.parent_make_invite(uuid), public.parent_disconnect(uuid) to authenticated;
grant execute on function public.parent_account_status(uuid), public.parent_save_account(uuid,text,text,boolean),
  public.parent_remove_account(uuid) to authenticated;
grant execute on function public.parent_connect(text), public.parent_home(text,text), public.parent_read(text,timestamptz),
  public.parent_logout(text), public.parent_set_push(text,text,boolean,text,text,text) to anon, authenticated;
grant execute on function public.parent_claim_push(), public.parent_finish_push(uuid,int,text) to service_role;

commit;
