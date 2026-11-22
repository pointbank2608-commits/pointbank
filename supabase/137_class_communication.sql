begin;

create table public.parent_class_channels (
  class_id uuid primary key references public.classes on delete cascade,
  teacher_id uuid references public.profiles on delete set null,
  settings jsonb not null default '{}',
  enabled_since jsonb not null default '{}'
);
create table public.parent_inquiries (
  id uuid primary key,
  class_id uuid not null references public.classes on delete cascade,
  student_id uuid not null references public.parent_accounts on delete cascade,
  guardian_key bytea not null,
  question text not null check (length(question) between 1 and 2000),
  created_at timestamptz not null default now(),
  answer text check (length(answer) between 1 and 2000),
  answered_at timestamptz
);
create index on public.parent_inquiries(class_id,created_at desc);
create index on public.parent_inquiries(student_id,created_at desc);
create table public.teacher_inquiry_devices (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles on delete cascade,
  endpoint text unique not null, p256dh text not null, auth_key text not null, lang text not null
);
create table public.teacher_inquiry_queue (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.parent_inquiries on delete cascade,
  device_id uuid not null references public.teacher_inquiry_devices on delete cascade,
  tries integer not null default 0, next_at timestamptz not null default now(),
  unique(inquiry_id,device_id)
);
create table public.parent_homework_starts (
  student_id uuid not null references public.students on delete cascade,
  source text not null, assignment_id uuid not null, happened_at timestamptz not null default now(),
  primary key(student_id,source,assignment_id)
);
alter table public.parent_class_channels enable row level security;
alter table public.parent_inquiries enable row level security;
alter table public.teacher_inquiry_devices enable row level security;
alter table public.teacher_inquiry_queue enable row level security;
alter table public.parent_homework_starts enable row level security;
revoke all on public.parent_class_channels,public.parent_inquiries,public.teacher_inquiry_devices,
  public.teacher_inquiry_queue,public.parent_homework_starts from public,anon,authenticated;

create function public.parent_channels(p_class uuid) returns jsonb
language sql stable set search_path=pg_catalog,public as $$
 select '{"published":true,"started":false,"completed":true,"overdue":true,"attendance":true,"feedback":true,"inquiry":false}'::jsonb
   || coalesce(c.settings,'{}') || jsonb_build_object('inquiry',coalesce((c.settings->>'inquiry')::boolean,false) and p.id is not null)
 from classes k left join parent_class_channels c on c.class_id=k.id
 left join profiles p on p.id=c.teacher_id and p.academy_id=k.academy_id and p.role in ('owner','teacher')
 where k.id=p_class
$$;

create function public.parent_channel(p_kind text) returns text language sql immutable as $$
 select case p_kind when 'daily_completed' then 'completed' when 'homework_checked' then 'completed'
   when 'homework_missing' then 'overdue' when 'checkout' then 'attendance' when 'attendance_changed' then 'attendance'
   when 'answered' then 'inquiry' else p_kind end
$$;

create function public.communication_staff(p_class uuid) returns void
language plpgsql stable set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from classes where id=p_class and academy_id=my_academy_id() and is_staff())
 then raise exception 'not_found'; end if;
end $$;

create function public.class_communication(p_class uuid,p_endpoint text default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare assigned uuid;
begin
 perform communication_staff(p_class);
 select teacher_id into assigned from parent_class_channels where class_id=p_class;
 return jsonb_build_object('subscribed',exists(select 1 from teacher_inquiry_devices where teacher_id=auth.uid() and endpoint=p_endpoint),
   'settings',parent_channels(p_class),'teacher',assigned,
   'teachers',(select jsonb_agg(jsonb_build_object('id',id,'name',display_name) order by display_name,id)
    from profiles where academy_id=my_academy_id() and role in ('owner','teacher')),
   'push_key',(select value from private_config where key='parent_push_public_key'),
   'threads',coalesce((select jsonb_agg(to_jsonb(row) order by row.created_at desc) from (
    select i.id,s.name,i.question,i.answer,i.created_at from parent_inquiries i join students s on s.id=i.student_id
    join parent_accounts a on a.student_id=s.id and a.login_key=i.guardian_key
    where assigned=auth.uid() and (parent_channels(p_class)->>'inquiry')::boolean and s.class_id=p_class
    and s.academy_id=my_academy_id() and i.class_id=p_class and s.archived_at is null order by i.created_at desc
   ) row),'[]'::jsonb));
end $$;

create function public.class_set_channel(p_class uuid,p_channel text,p_enabled boolean,p_teacher uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare assigned uuid; previously boolean;
begin
 perform communication_staff(p_class);
 if p_enabled is null or p_channel is null or not parent_channels(p_class) ? p_channel then raise exception 'bad_channel'; end if;
 insert into parent_class_channels(class_id) values(p_class) on conflict do nothing;
 select teacher_id into assigned from parent_class_channels where class_id=p_class for update;
 previously:=(parent_channels(p_class)->>p_channel)::boolean;
 if p_channel='inquiry' and p_enabled then
   if not exists(select 1 from profiles where id=p_teacher and academy_id=my_academy_id() and role in ('teacher','owner'))
   then raise exception 'teacher_required'; end if;
   if p_teacher is distinct from assigned and not is_owner() and
     (p_teacher<>auth.uid() or (assigned is not null and assigned<>auth.uid())) then raise exception 'not_assigned'; end if;
   assigned:=p_teacher;
 end if;
 update parent_class_channels set settings=settings||jsonb_build_object(p_channel,p_enabled),teacher_id=assigned,
   enabled_since=case when p_enabled and not previously then enabled_since||jsonb_build_object(p_channel,now()) else enabled_since end
   where class_id=p_class;
 if p_channel='inquiry' then
   delete from teacher_inquiry_queue q using parent_inquiries i,teacher_inquiry_devices d where q.inquiry_id=i.id
    and q.device_id=d.id and i.class_id=p_class and (not p_enabled or d.teacher_id<>assigned);
 end if;
end $$;

create function public.parent_ask(p_token text,p_request uuid,p_question text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare sid uuid:=(parent_resolve(p_token)).student_id; cid uuid; guardian bytea; prior parent_inquiries;
begin
 select s.class_id,a.login_key into cid,guardian from students s join parent_accounts a on a.student_id=s.id where s.id=sid;
 if cid is null or not (parent_channels(cid)->>'inquiry')::boolean then raise exception 'unavailable'; end if;
 insert into parent_inquiries(id,class_id,student_id,guardian_key,question) values(p_request,cid,sid,guardian,btrim(p_question))
 on conflict(id) do nothing;
 if not found then
   select * into prior from parent_inquiries where id=p_request;
   if prior.student_id<>sid or prior.class_id<>cid or prior.guardian_key<>guardian or prior.question<>btrim(p_question)
   then raise exception 'request_conflict'; end if;
   return;
 end if;
 insert into teacher_inquiry_queue(inquiry_id,device_id) select p_request,d.id from parent_class_channels c
 join teacher_inquiry_devices d on d.teacher_id=c.teacher_id where c.class_id=cid;
end $$;

alter table parent_push_queue drop constraint parent_push_queue_event_check;
alter table parent_push_queue add check(event in ('published','started','completed','overdue','attendance','checkout',
 'attendance_changed','feedback','daily_completed','homework_checked','homework_missing','answered'));

create function public.parent_answer(p_class uuid,p_thread uuid,p_answer text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
declare thread parent_inquiries;
begin
 perform communication_staff(p_class);
 select i.* into thread from parent_inquiries i join students s on s.id=i.student_id and s.class_id=i.class_id
 join parent_accounts a on a.student_id=s.id and a.login_key=i.guardian_key
 join parent_class_channels c on c.class_id=i.class_id and c.teacher_id=auth.uid()
 where i.class_id=p_class and i.id=p_thread and s.archived_at is null and s.academy_id=my_academy_id()
 and (parent_channels(p_class)->>'inquiry')::boolean for update of i;
 if not found or p_answer is null then raise exception 'unavailable'; end if;
 if thread.answer is not null then
   if thread.answer=btrim(p_answer) then return; end if;
   raise exception 'already_answered';
 end if;
 update parent_inquiries set answer=btrim(p_answer),answered_at=now() where id=p_thread;
 insert into parent_push_queue(device_id,source,assignment_id,event)
 select d.id,'inquiry',p_thread,'answered' from parent_push_devices d join parent_sessions p on p.id=d.session_id
 where p.student_id=thread.student_id and p.expires_at>now() on conflict do nothing;
end $$;

-- Every homework type has an authoritative first-start transition.
create function public.parent_record_start() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare src text:=tg_argv[0]; sid uuid; aid uuid;
begin
 if src='words' then
   aid:=new.target_id;
   select student_id into sid from wm_targets where id=aid;
 else
   sid:=new.student_id;
   if src='online' then aid:=new.assignment_id; else aid:=new.id; end if;
 end if;
 if not exists(select 1 from parent_homework_rows h join students s on s.id=h.student_id
   where h.student_id=sid and h.source=src and h.assignment_id=aid and s.archived_at is null)
 then return new; end if;
 insert into parent_homework_starts(student_id,source,assignment_id) values(sid,src,aid) on conflict do nothing;
 if found then
   insert into parent_push_queue(device_id,source,assignment_id,event)
   select d.id,src,aid,'started' from parent_sessions p join parent_push_devices d on d.session_id=p.id
   where p.student_id=sid and p.expires_at>now() on conflict do nothing;
 end if;
 return new;
end $$;
create trigger parent_online_started after insert on homework_attempts for each row when(new.started_at is not null)
 execute function parent_record_start('online');
create trigger parent_solo_started after insert or update of started_at on solo_assignments for each row when(new.started_at is not null)
 execute function parent_record_start('solo');
create trigger parent_grammar_started after insert or update of run_id on grammar_assignments for each row when(new.run_id is not null)
 execute function parent_record_start('grammar');
create trigger parent_words_started after insert on wm_sessions for each row execute function parent_record_start('words');

alter view parent_notice_rows rename to parent_notice_rows_v135;
create view public.parent_notice_rows as
 select n.* from (
   select * from parent_notice_rows_v135
   union all
   select h.student_id,h.source,h.assignment_id,'started',r.happened_at,h.title,null,'{}'::jsonb
   from parent_homework_starts r join parent_homework_rows h using(student_id,source,assignment_id)
   union all
   select i.student_id,'inquiry',i.id,'answered',i.answered_at,'',null,'{}'::jsonb
   from parent_inquiries i join parent_accounts a on a.student_id=i.student_id and a.login_key=i.guardian_key
   join students s on s.id=i.student_id and s.class_id=i.class_id where i.answer is not null
 ) n join students s on s.id=n.student_id left join parent_class_channels c on c.class_id=s.class_id
 where (parent_channels(s.class_id)->>parent_channel(n.kind))::boolean
 and n.happened_at>=coalesce((c.enabled_since->>parent_channel(n.kind))::timestamptz,'-infinity');
revoke all on parent_notice_rows from public,anon,authenticated;

create function public.parent_check_queue_channel() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not exists(select 1 from parent_push_devices d join parent_sessions p on p.id=d.session_id join students s on s.id=p.student_id
   where d.id=new.device_id and (parent_channels(s.class_id)->>parent_channel(new.event))::boolean)
 then return null; end if;
 return new;
end $$;
create trigger parent_queue_channel before insert on parent_push_queue for each row execute function parent_check_queue_channel();

alter function parent_home(text,text) rename to parent_home_v135;
revoke all on function parent_home_v135(text,text) from public,anon,authenticated;
create function public.parent_home(p_token text,p_endpoint text default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare sid uuid:=(parent_resolve(p_token)).student_id; result jsonb:=parent_home_v135(p_token,p_endpoint); flags jsonb; cid uuid;
begin
 if sid is null then return result; end if;
 select class_id into cid from students where id=sid;
 flags:=parent_channels(cid);
 return result||jsonb_build_object('settings',flags,
  'attendance',case when (flags->>'attendance')::boolean then result->'attendance' else '[]'::jsonb end,
  'homework',coalesce((select jsonb_agg((h-'status'-'completed_at'-'daily')||jsonb_strip_nulls(jsonb_build_object(
    'completed_at',case when (flags->>'completed')::boolean then h->'completed_at' end,
    'status',case when h->>'status' in ('started','completed','overdue') and not (flags->>(h->>'status'))::boolean then 'assigned'
       when h->>'status'='review' and not (flags->>'completed')::boolean then 'assigned' else h->>'status' end,
    'daily',case when h->'daily'->>'day' is not null then jsonb_build_object('day',h->'daily'->'day',
      'started',(flags->>'started')::boolean and (h->'daily'->>'started')::boolean,
      'completed_at',case when (flags->>'completed')::boolean then h->'daily'->'completed_at' end) end)))
    from jsonb_array_elements(result->'homework') h where (flags->>'published')::boolean),'[]'::jsonb),
  'threads',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'question',i.question,'answer',i.answer,'created_at',i.created_at)
    order by i.created_at desc) from parent_inquiries i join parent_accounts a on a.student_id=i.student_id and a.login_key=i.guardian_key
    where i.student_id=sid and i.class_id=cid and (flags->>'inquiry')::boolean),'[]'::jsonb));
end $$;

create function public.parent_feedback_channel() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not (select (parent_channels(class_id)->>'feedback')::boolean from students where id=new.student_id)
 then raise exception 'feedback_disabled'; end if;
 return new;
end $$;
create trigger feedback_channel before insert on parent_feedback for each row execute function parent_feedback_channel();

create function public.teacher_set_inquiry_push(p_endpoint text,p_enabled boolean,p_p256dh text,p_auth text,p_lang text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if not coalesce(is_staff(),false) or auth.uid() is null then raise exception 'not_staff'; end if;
 if not p_enabled then
   delete from teacher_inquiry_devices where endpoint=p_endpoint and teacher_id=auth.uid();
   return;
 end if;
 if length(p_endpoint)>2048 or p_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[A-Za-z0-9_./:~%?=&+-]+$'
 or p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or p_auth !~ '^[A-Za-z0-9_-]{22}$' then raise exception 'bad_subscription'; end if;
 delete from teacher_inquiry_devices where endpoint=p_endpoint and teacher_id<>auth.uid();
 insert into teacher_inquiry_devices(teacher_id,endpoint,p256dh,auth_key,lang)
 values(auth.uid(),p_endpoint,p_p256dh,p_auth,case when p_lang='en' then 'en' else 'ko' end)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_key=excluded.auth_key,lang=excluded.lang
 where teacher_inquiry_devices.teacher_id=auth.uid();
end $$;

create function public.inquiry_claim_push() returns table(id uuid,session_id uuid,tries int,endpoint text,p256dh text,
 auth_key text,lang text,event text,thread_id uuid,class_id uuid)
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 delete from teacher_inquiry_queue q using parent_inquiries i where q.inquiry_id=i.id and i.created_at<now()-interval '1 day';
 return query with batch as (
  select q.id from teacher_inquiry_queue q join teacher_inquiry_devices d on d.id=q.device_id
  join parent_inquiries i on i.id=q.inquiry_id join parent_accounts a on a.student_id=i.student_id and a.login_key=i.guardian_key
  join students s on s.id=i.student_id and s.class_id=i.class_id and s.archived_at is null
  join parent_class_channels c on c.class_id=i.class_id and c.teacher_id=d.teacher_id
  where q.next_at<=now() and q.tries<5 and i.answer is null and (parent_channels(i.class_id)->>'inquiry')::boolean
  order by q.next_at limit 25 for update of q skip locked
 ), claimed as (
  update teacher_inquiry_queue q set tries=q.tries+1,next_at=now()+interval '2 minutes'*power(2,q.tries)
  from batch b where q.id=b.id returning q.*
 ) select q.id,null::uuid,q.tries,d.endpoint,d.p256dh,d.auth_key,d.lang,'inquiry'::text,i.id,i.class_id
 from claimed q join teacher_inquiry_devices d on d.id=q.device_id join parent_inquiries i on i.id=q.inquiry_id;
 return query select j.*,case when j.event='answered' then q.assignment_id end,null::uuid from parent_claim_push() j
 left join parent_push_queue q on q.id=j.id;
end $$;

create function public.teacher_finish_inquiry_push(p_id uuid,p_try int,p_result text) returns void
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if p_result='gone' then
  delete from teacher_inquiry_devices d using teacher_inquiry_queue q where q.device_id=d.id and q.id=p_id and q.tries=p_try;
 elsif p_result in ('sent','discard') then delete from teacher_inquiry_queue where id=p_id and tries=p_try;
 end if;
end $$;

revoke all on function parent_channels(uuid), parent_channel(text),communication_staff(uuid),class_communication(uuid,text),
 class_set_channel(uuid,text,boolean,uuid),parent_ask(text,uuid,text),parent_answer(uuid,uuid,text),parent_record_start(),
 parent_check_queue_channel(),parent_home(text,text),parent_feedback_channel(),teacher_set_inquiry_push(text,boolean,text,text,text),
 inquiry_claim_push(),teacher_finish_inquiry_push(uuid,int,text) from public,anon,authenticated;
grant execute on function parent_home(text,text),parent_ask(text,uuid,text) to anon,authenticated;
grant execute on function class_communication(uuid,text),class_set_channel(uuid,text,boolean,uuid),parent_answer(uuid,uuid,text),
 teacher_set_inquiry_push(text,boolean,text,text,text) to authenticated;
grant execute on function inquiry_claim_push(),teacher_finish_inquiry_push(uuid,int,text) to service_role;
commit;
