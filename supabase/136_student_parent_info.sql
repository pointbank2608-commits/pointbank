-- Save student information and optional portal accounts in one transaction.
begin;
create table public.student_info_requests(
  id uuid primary key,
  academy_id uuid not null references public.academies(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  input_hash bytea not null
);
alter table public.student_info_requests enable row level security;
revoke all on public.student_info_requests from public,anon,authenticated;

create function public.student_save_info(
  p_request uuid,p_student uuid,p_class uuid,p_name text,
  p_login_phone text default null,p_login_consent boolean default false,
  p_parent_name text default null,p_parent_phone text default null,p_parent_consent boolean default false
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare academy uuid:=public.my_academy_id(); sid uuid; prior public.student_info_requests;
  fingerprint bytea; secret text; student_name text:=btrim(p_name); existing_phone text;
begin
  if not coalesce(public.is_staff(),false) or academy is null then raise exception 'not_staff'; end if;
  if p_request is null or coalesce(char_length(student_name),0) not between 1 and 100 then raise exception 'bad_name'; end if;
  if not exists(select 1 from public.classes where id=p_class and academy_id=academy) then raise exception 'not_found'; end if;
  select value into strict secret from public.private_config where key='guardian_phone_key';
  fingerprint:=extensions.hmac(jsonb_build_object('student',p_student,'class',p_class,'name',student_name,
    'login_phone',p_login_phone,'login_consent',p_login_consent,'parent_name',p_parent_name,
    'parent_phone',p_parent_phone,'parent_consent',p_parent_consent)::text,secret,'sha256');
  perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
  select * into prior from public.student_info_requests where id=p_request;
  if found then
    if prior.academy_id<>academy or prior.input_hash<>fingerprint then raise exception 'request_conflict'; end if;
    return jsonb_build_object('student_id',prior.student_id);
  end if;
  if p_student is null then
    insert into public.students(academy_id,class_id,name) values(academy,p_class,student_name) returning id into sid;
  else
    sid:=p_student;
    perform 1 from public.students where id=sid and academy_id=academy and class_id=p_class and archived_at is null for no key update;
    if not found then raise exception 'not_found'; end if;
    select convert_from(extensions.pgp_sym_decrypt_bytea(g.phone_enc,secret),'UTF8')
      into existing_phone from public.student_guardian g where student_id=sid;
    if p_login_phone is null and existing_phone is not null then
      perform pg_advisory_xact_lock(hashtextextended(academy::text||':'||public.sp_name_key(student_name),0));
      if exists(select 1 from public.students s join public.student_guardian g on g.student_id=s.id
        where s.academy_id=academy and s.archived_at is null and s.id<>sid
          and public.sp_name_key(s.name)=public.sp_name_key(student_name)
          and extensions.crypt(existing_phone,g.phone_hash)=g.phone_hash) then raise exception 'duplicate_student'; end if;
    end if;
    update public.students set name=student_name where id=sid;
  end if;
  if p_login_phone is not null then perform public.student_guardian_set(sid,p_login_phone,p_login_consent); end if;
  if p_parent_name is not null or p_parent_phone is not null then
    perform public.parent_save_account(sid,p_parent_name,p_parent_phone,p_parent_consent);
  end if;
  insert into public.student_info_requests values(p_request,academy,sid,fingerprint);
  return jsonb_build_object('student_id',sid);
end $$;
revoke all on function public.student_save_info(uuid,uuid,uuid,text,text,boolean,text,text,boolean) from public,anon,authenticated;
grant execute on function public.student_save_info(uuid,uuid,uuid,text,text,boolean,text,text,boolean) to authenticated;

-- One parent opt-in covers every child returned by that login.
create function public.parent_set_family_push(
  p_tokens text[],p_endpoint text,p_enabled boolean,
  p_p256dh text default null,p_auth text default null,p_lang text default 'ko'
) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare token text; result jsonb;
begin
  if coalesce(cardinality(p_tokens),0) not between 1 and 50 then raise exception 'expired'; end if;
  if exists(select 1 from unnest(p_tokens) value where (public.parent_resolve(value)).id is null) then
    raise exception 'expired';
  end if;
  for token in select distinct value from unnest(p_tokens) value order by value loop
    result:=public.parent_set_push(token,p_endpoint,p_enabled,p_p256dh,p_auth,p_lang);
    if result ? 'error' then raise exception '%',result->>'error'; end if;
  end loop;
  return jsonb_build_object('enabled',coalesce(p_enabled,false));
end $$;
revoke all on function public.parent_set_family_push(text[],text,boolean,text,text,text) from public,anon,authenticated;
grant execute on function public.parent_set_family_push(text[],text,boolean,text,text,text) to anon,authenticated;
commit;
