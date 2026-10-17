-- Homework block editor. Apply after 086u, on a local/test database first.
-- Existing assignments, student sessions, reward and calendar functions are preserved.
begin;

create table public.homework_drafts (
  id uuid primary key,
  academy_id uuid not null references public.academies(id),
  class_id uuid not null references public.classes(id),
  owner_id uuid not null references auth.users(id),
  revision int not null default 1,
  document jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.homework_drafts enable row level security;
-- All mutations use RPC with optimistic revision validation. No direct client write grants.
revoke all on public.homework_drafts from anon, authenticated;
alter table public.homework_assignments add column block_request uuid;
alter table public.homework_assignments add column block_payload text;
create unique index homework_block_request on public.homework_assignments(academy_id, block_request) where block_request is not null;

create function public.hw_frozen_item_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
 if old.config ? 'block' or exists(select 1 from public.homework_assignments where id=old.assignment_id and block_request is not null) then raise exception 'assignment_version_frozen'; end if;
 return new;
end $$;
revoke all on function public.hw_frozen_item_guard() from public,anon,authenticated;
create trigger homework_block_snapshot_frozen before update on public.homework_items for each row execute function public.hw_frozen_item_guard();

create function public.hw_block_academy(p_class uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare a uuid := public.hw_staff_academy();
begin
  if not public.academy_feature(a, 'homework') then raise exception 'feature_closed'; end if;
  if not exists (select 1 from public.classes where id = p_class and academy_id = a) then raise exception 'bad_class'; end if;
  return a;
end $$;

create function public.hw_validate_items(p_items jsonb, p_draft boolean default false) returns void
language plpgsql immutable set search_path = public as $$
declare i jsonb; b jsonb; q jsonb; c jsonb; v text; n int;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or octet_length(p_items::text) > 1000000 then raise exception 'bad_items'; end if;
  if jsonb_array_length(p_items) > 60 or (not p_draft and jsonb_array_length(p_items) = 0) then raise exception 'no_items'; end if;
  for i in select value from jsonb_array_elements(p_items) loop
    if coalesce(i->>'kind','') not in ('quiz','worksheet','game','shadowing') or jsonb_typeof(i->'config') is distinct from 'object' or jsonb_typeof(i->'content'->'questions') is distinct from 'array' then raise exception 'bad_item'; end if;
    b := i->'config'->'block';
    if b is not null then
      if b->>'schemaVersion' is distinct from '1' or coalesce(b->>'type','') not in ('study','recall','speak','sentence','video') then raise exception 'unsupported_block'; end if;
      if coalesce(b->>'completion','') not in ('confirm','answers','recording','review','watch') then raise exception 'bad_completion'; end if;
      if (b->>'type' = 'study' and b->>'completion' <> 'confirm') or (b->>'type' = 'recall' and b->>'completion' <> 'answers') or (b->>'type' = 'speak' and b->>'completion' <> 'recording') or (b->>'type' = 'sentence' and b->>'completion' not in ('answers','review')) or (b->>'type' = 'video' and b->>'completion' not in ('watch','review','recording')) then raise exception 'bad_completion'; end if;
      foreach v in array array['text','translation','question','imageUrl','audioUrl','videoUrl'] loop
        if jsonb_typeof(b->v) is distinct from 'string' or length(b->>v) > 5000 then raise exception 'bad_content'; end if;
      end loop;
      foreach v in array array['imageUrl','audioUrl'] loop
        if coalesce(b->>v,'') <> '' and (b->>v !~ '^(https://|/[^/])') then raise exception 'bad_media_url'; end if;
      end loop;
      if jsonb_typeof(b->'stages') is distinct from 'array' or jsonb_typeof(b->'hiddenWords') is distinct from 'array' or jsonb_array_length(b->'hiddenWords') > 500 then raise exception 'bad_stages'; end if;
      if coalesce(b->>'repeats','') !~ '^[1-5]$' then raise exception 'bad_repeats'; end if;
      if exists(select 1 from jsonb_array_elements_text(b->'stages') s where s not in ('model','hidden','picture')) or jsonb_array_length(b->'stages') > 3 then raise exception 'bad_stages'; end if;
      if exists(select 1 from jsonb_array_elements_text(b->'hiddenWords') h where h !~ '^[0-9]{1,3}$') then raise exception 'bad_mask'; end if;
      if not p_draft then
        if b->>'type' not in ('video','recall') and length(trim(b->>'text')) = 0 then raise exception 'missing_content'; end if;
        if b->>'type' = 'speak' and jsonb_array_length(b->'stages') = 0 then raise exception 'bad_stages'; end if;
        if b->>'type' = 'video' and (b->>'videoUrl' !~ '(youtube\.com/(watch\?v=|embed/|shorts/)|youtu\.be/)[A-Za-z0-9_-]{11}' and b->>'videoUrl' !~ '^[A-Za-z0-9_-]{11}$') then raise exception 'bad_video'; end if;
        if b->>'type' = 'video' then
          if jsonb_typeof(b->'start') is distinct from 'number' or jsonb_typeof(b->'end') is distinct from 'number' then raise exception 'bad_segment'; end if;
          if (b->>'start')::numeric < 0 or (b->>'end')::numeric <= (b->>'start')::numeric or (b->>'end')::numeric - (b->>'start')::numeric > 1200 then raise exception 'bad_segment'; end if;
        end if;
      end if;
      if b->>'completion' <> 'answers' and jsonb_array_length(i->'content'->'questions') <> 0 then raise exception 'ungraded_has_questions'; end if;
    end if;
    n := jsonb_array_length(i->'content'->'questions');
    if n > 200 then raise exception 'too_many_questions'; end if;
    if not p_draft and n = 0 and coalesce(b->>'completion','answers') = 'answers' and i->>'kind' <> 'shadowing' then raise exception 'no_questions'; end if;
    if not p_draft then
      for q in select value from jsonb_array_elements(i->'content'->'questions') loop
        if coalesce(q->>'qtype','') not in ('choice','text','order') then raise exception 'bad_question'; end if;
        if length(coalesce(q->>'prompt','')) > 5000 or q->'correct' is null or q->'correct' = 'null'::jsonb then raise exception 'bad_question'; end if;
        if q->>'style'='listen' and length(trim(coalesce(q->>'speak','')))=0 then raise exception 'missing_audio_text'; end if;
        if q->>'style'='picture' and length(trim(coalesce(q->>'imageUrl','')))=0 then raise exception 'missing_picture'; end if;
        if q->>'qtype' = 'choice' then
          c := q->'choices';
          if jsonb_typeof(c) is distinct from 'array' or jsonb_array_length(c) < 2 or jsonb_array_length(c) > 10 or q->>'correct' !~ '^[0-9]$' then raise exception 'bad_choices'; end if;
          if (q->>'correct')::int >= jsonb_array_length(c) or exists (select 1 from jsonb_array_elements(c) x where jsonb_typeof(x) <> 'string' or length(trim(x #>> '{}')) = 0) then raise exception 'bad_choices'; end if;
          if (select count(distinct x) from jsonb_array_elements(c) x) <> jsonb_array_length(c) then raise exception 'duplicate_choices'; end if;
          if q->>'style' = 'meaning' and exists(select 1 from jsonb_array_elements_text(c) x where length(x) > 45 or x ~ E'[\n\r→=]' or x ~* '(문법|예문|주의|규칙|설명|동사원형|주어|목적어|과거형|현재형|접속사|분사구문|grammar[ :]|note:|example:)') then raise exception 'meaning_contains_notes'; end if;
        elsif q->>'qtype' = 'text' then
          if jsonb_typeof(q->'correct') <> 'string' or length(trim(q->>'correct')) = 0 or length(q->>'correct')>300 then raise exception 'bad_answer'; end if;
        else
          if jsonb_typeof(q->'correct') <> 'array' or jsonb_typeof(q->'tokens') <> 'array' or jsonb_array_length(q->'correct') = 0 then raise exception 'bad_order'; end if;
          if length((q->'correct')::text)>300 or exists(select 1 from jsonb_array_elements_text(q->'correct') part where length(trim(part))=0) then raise exception 'bad_order'; end if;
        end if;
      end loop;
    end if;
  end loop;
end $$;

create function public.hw_drafts(p_class uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := public.hw_block_academy(p_class);
begin
 return coalesce((select jsonb_agg(document || jsonb_build_object('revision',revision) order by updated_at desc) from public.homework_drafts where academy_id = a and class_id = p_class and owner_id = auth.uid()), '[]');
end $$;

create function public.hw_save_draft(p_class uuid, p_draft jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := public.hw_block_academy(p_class); d public.homework_drafts; k uuid := (p_draft->>'id')::uuid; r int;
begin
 perform public.hw_validate_items(p_draft->'items',true);
 perform pg_advisory_xact_lock(hashtextextended(k::text,0));
 select * into d from public.homework_drafts where id = k for update;
 if found then
   if d.academy_id <> a or d.class_id <> p_class or d.owner_id <> auth.uid() then raise exception 'not_found'; end if;
   if d.revision <> (p_draft->>'revision')::int then raise exception 'draft_conflict'; end if;
   r := d.revision + 1;
 else r := 1;
 end if;
 insert into public.homework_drafts(id,academy_id,class_id,owner_id,revision,document) values(k,a,p_class,auth.uid(),r,p_draft || jsonb_build_object('revision',r))
 on conflict(id) do update set revision = excluded.revision, document = excluded.document, updated_at = now();
 return p_draft || jsonb_build_object('revision',r);
end $$;

-- Wrap existing create function so legacy callers also retain server validation and feature gate.
alter function public.hw_create_v2(uuid,text,jsonb,uuid[],timestamptz,text,uuid,jsonb) rename to hw_create_v2_before_blocks;
revoke all on function public.hw_create_v2_before_blocks(uuid,text,jsonb,uuid[],timestamptz,text,uuid,jsonb) from public,anon,authenticated;
create function public.hw_create_v2(p_class_id uuid,p_title text,p_items jsonb,p_student_ids uuid[] default null,p_due_at timestamptz default null,p_kind text default 'class',p_group_id uuid default null,p_recommendation jsonb default null)
returns public.homework_assignments language plpgsql security definer set search_path = public as $$
begin
 perform public.hw_block_academy(p_class_id);
 perform public.hw_validate_items(p_items);
 return public.hw_create_v2_before_blocks(p_class_id,p_title,p_items,p_student_ids,p_due_at,p_kind,p_group_id,p_recommendation);
end $$;

create function public.hw_create_once(p_request uuid,p_class_id uuid,p_title text,p_items jsonb,p_student_ids uuid[] default null,p_due_at timestamptz default null,p_kind text default 'class',p_group_id uuid default null,p_recommendation jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a uuid := public.hw_block_academy(p_class_id); h public.homework_assignments; digest text;
begin
 if p_request is null then raise exception 'missing_request'; end if;
 digest := md5(jsonb_build_array(p_class_id,p_title,p_items,p_student_ids,p_due_at,p_kind,p_group_id,p_recommendation)::text);
 perform pg_advisory_xact_lock(hashtextextended(a::text || p_request::text,0));
 select * into h from public.homework_assignments where academy_id=a and block_request=p_request;
 if found then
   if h.block_payload <> digest then raise exception 'request_conflict'; end if;
   return jsonb_build_object('id',h.id,'code',h.code);
 end if;
 h := public.hw_create_v2(p_class_id,p_title,p_items,p_student_ids,p_due_at,p_kind,p_group_id,p_recommendation);
 update public.homework_assignments set block_request=p_request,block_payload=digest where id=h.id;
 return jsonb_build_object('id',h.id,'code',h.code);
end $$;
revoke all on function public.hw_create_once(uuid,uuid,text,jsonb,uuid[],timestamptz,text,uuid,jsonb) from public,anon;
grant execute on function public.hw_create_once(uuid,uuid,text,jsonb,uuid[],timestamptz,text,uuid,jsonb) to authenticated;

create function public.hw_assign_draft(p_class uuid,p_draft jsonb,p_students uuid[],p_due timestamptz,p_request uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a uuid := public.hw_block_academy(p_class); h public.homework_assignments; digest text;
begin
 if p_request is null then raise exception 'missing_request'; end if;
 digest := md5(jsonb_build_object('class',p_class,'draft',p_draft,'students',p_students,'due',p_due)::text);
 perform pg_advisory_xact_lock(hashtextextended(a::text || p_request::text,0));
 select * into h from public.homework_assignments where academy_id = a and block_request = p_request;
 if found then
   if h.block_payload <> digest then raise exception 'request_conflict'; end if;
   return jsonb_build_object('id',h.id,'code',h.code);
 end if;
 perform public.hw_validate_items(p_draft->'items');
 h := public.hw_create_v2(p_class,coalesce(p_draft->>'title',''),p_draft->'items',p_students,p_due,case when p_students is null then 'class' else 'selected' end,null,null);
 update public.homework_assignments set block_request = p_request,block_payload = digest, settings = settings || jsonb_build_object('draftId',p_draft->>'id','draftRevision',p_draft->'revision','blockSchema',1) where id = h.id;
 return jsonb_build_object('id',h.id,'code',h.code);
end $$;

-- Minimize student payload; teacher-only sources and answer snapshots are omitted.
alter function public.hw_public_item(public.homework_items) rename to hw_public_item_before_blocks;
create function public.hw_public_item(i public.homework_items) returns jsonb
language sql stable as $$
 select jsonb_build_object('id',i.id,'kind',i.kind,'title',i.title,
   'config',case when i.config ? 'block' then jsonb_set(i.config,'{block}',((i.config->'block') - 'source') - case when i.config->'block'->>'completion' = 'answers' then 'text' else '__unused' end) else i.config end,
   'content',(i.content - 'questions') || jsonb_build_object('questions',coalesce((select jsonb_agg(q - 'correct' - 'card' order by ord) from jsonb_array_elements(coalesce(i.content->'questions','[]')) with ordinality t(q,ord)),'[]')))
$$;

-- Authenticate and check item ownership BEFORE legacy idempotency lookup.
alter function public.hw_submit(uuid,uuid,int,text,uuid,int) rename to hw_submit_before_blocks;
revoke all on function public.hw_submit_before_blocks(uuid,uuid,int,text,uuid,int) from public,anon,authenticated;
create function public.hw_submit(p_token uuid,p_item_id uuid,p_q_index int,p_response text,p_client_id uuid,p_ms int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.homework_attempts;
begin
 t := public.hw_attempt_for(p_token);
 perform 1 from public.homework_attempts where id=t.id for update;
 if not exists(select 1 from public.homework_items where id=p_item_id and assignment_id=t.assignment_id) then raise exception 'not_found'; end if;
 if exists(select 1 from public.learning_events where client_id=p_client_id and (attempt_id is distinct from t.id or item_id is distinct from p_item_id or q_index is distinct from p_q_index)) then raise exception 'not_found'; end if;
 if length(p_response)>5000 then raise exception 'bad_response'; end if;
 return public.hw_submit_before_blocks(p_token,p_item_id,p_q_index,p_response,p_client_id,p_ms);
end $$;

alter function public.hw_progress(uuid,uuid,text,jsonb,uuid) rename to hw_progress_before_blocks;
revoke all on function public.hw_progress_before_blocks(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated;
create function public.hw_progress(p_token uuid,p_item_id uuid,p_event text,p_meta jsonb,p_client_id uuid) returns jsonb
language plpgsql security definer set search_path = public,storage as $$
declare t public.homework_attempts; i public.homework_items; b jsonb; m jsonb; r jsonb; path text;
begin
 t := public.hw_attempt_for(p_token);
 perform 1 from public.homework_attempts where id=t.id for update;
 select * into i from public.homework_items where id=p_item_id and assignment_id=t.assignment_id;
 if not found then raise exception 'not_found'; end if;
 if exists(select 1 from public.learning_events where client_id=p_client_id and (attempt_id is distinct from t.id or item_id is distinct from p_item_id)) then raise exception 'not_found'; end if;
 b := i.config->'block';
 if b is not null then
   if b->>'schemaVersion' is distinct from '1' then raise exception 'unsupported_block'; end if;
   if p_event <> 'item_complete' then raise exception 'bad_event'; end if;
   if exists(select 1 from public.homework_item_attempts where attempt_id=t.id and item_id=i.id and finished_at is not null) then return jsonb_build_object('ok',true); end if;
   if octet_length(p_meta::text)>10000 or jsonb_typeof(p_meta) is distinct from 'object' then raise exception 'bad_response'; end if;
   if b->>'completion' = 'confirm' and coalesce(p_meta->>'confirmed','false') <> 'true' then raise exception 'incomplete'; end if;
   if b->>'type' = 'video' and coalesce(p_meta->>'watched','false') <> 'true' then raise exception 'incomplete'; end if;
   if b->>'completion' = 'review' and (length(trim(coalesce(p_meta->>'response',''))) = 0 or length(p_meta->>'response')>2000) then raise exception 'incomplete'; end if;
   if b->>'completion' = 'recording' then
     path := p_meta->>'recording';
     if path is null or path not like t.id::text || '/' || i.id::text || '/%' or not exists(select 1 from storage.objects where bucket_id='homework-recordings' and name=path) then raise exception 'incomplete'; end if;
     if jsonb_typeof(p_meta->'duration') is distinct from 'number' or (p_meta->>'duration')::numeric not between 0.5 and 120 then raise exception 'bad_recording'; end if;
     if not exists(select 1 from storage.objects o where o.bucket_id='homework-recordings' and o.name=path and (o.user_metadata->>'duration')::numeric between 0.5 and 120.25) then raise exception 'bad_recording'; end if;
   end if;
   m := jsonb_build_object('response',left(p_meta->>'response',2000),'recording',path,
     'duration',p_meta->'duration','hints',greatest(0,least(coalesce((p_meta->>'hints')::int,0),10000)),
     'listens',greatest(0,least(coalesce((p_meta->>'listens')::int,0),10000)),
     'watched',b->>'type'='video','review',case when b->>'completion' in ('review','recording') then 'pending' else 'none' end);
 end if;
 r := public.hw_progress_before_blocks(p_token,p_item_id,p_event,p_meta,p_client_id);
 if b is not null then update public.homework_item_attempts set meta=meta || m where attempt_id=t.id and item_id=i.id; end if;
 return r;
end $$;

alter function public.hw_finish(uuid) rename to hw_finish_before_blocks;
revoke all on function public.hw_finish_before_blocks(uuid) from public,anon,authenticated;
create function public.hw_finish(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.homework_attempts;
begin
 t := public.hw_attempt_for(p_token,true);
 perform 1 from public.homework_attempts where id=t.id for update;
 return public.hw_finish_before_blocks(p_token);
end $$;
revoke all on function public.hw_finish(uuid) from public;
grant execute on function public.hw_finish(uuid) to anon,authenticated;

create function public.hw_block_results(p_assignment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a uuid := public.hw_staff_academy(); c uuid;
begin
 select class_id into c from public.homework_assignments where id=p_assignment and academy_id=a;
 if c is null then raise exception 'not_found'; end if;
 perform public.hw_block_academy(c);
 return coalesce((select jsonb_agg(row_to_json(x) order by (x.meta->>'review'='pending') desc nulls last,x.name,x.position) from (
   select t.id attempt_id,i.id item_id,s.name,i.title,i.position,coalesce(ia.meta,'{}') meta,ia.finished_at is not null finished,ia.id is not null started,
     (select count(*) from public.homework_answers ha where ha.attempt_id=t.id and ha.item_id=i.id) answered,
     coalesce(ia.score,0) first_correct,jsonb_array_length(i.content->'questions') total,coalesce(ia.retry_count,0) retries,
     (select count(*) from (select distinct on(e.q_index) e.correct from public.learning_events e where e.attempt_id=t.id and e.item_id=i.id and e.event_type in ('answer','retry_answer') order by e.q_index,e.created_at desc,e.id desc) latest where latest.correct) final_correct
   from public.homework_attempts t join public.students s on s.id=t.student_id join public.homework_items i on i.assignment_id=t.assignment_id
   left join public.homework_item_attempts ia on ia.attempt_id=t.id and ia.item_id=i.id
   where t.assignment_id=p_assignment and i.config ? 'block'
 ) x),'[]');
end $$;

create function public.hw_review_block(p_attempt uuid,p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid := public.hw_staff_academy(); c uuid;
begin
 select h.class_id into c from public.homework_attempts t join public.homework_assignments h on h.id=t.assignment_id join public.homework_items i on i.assignment_id=h.id where t.id=p_attempt and i.id=p_item and h.academy_id=a;
 if c is null then raise exception 'not_found'; end if;
 perform public.hw_block_academy(c);
 update public.homework_item_attempts set meta=meta || jsonb_build_object('review','reviewed','reviewedAt',now(),'reviewedBy',auth.uid()) where attempt_id=p_attempt and item_id=p_item and finished_at is not null and meta->>'review'='pending';
end $$;

-- Private audio: only the Edge Function service key writes/reads Storage, after RPC authorization.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('homework-recordings','homework-recordings',false,8388608,array['audio/webm','audio/ogg','audio/mp4']) on conflict(id) do nothing;
create function public.hw_recording_target(p_token uuid,p_item uuid) returns text
language plpgsql security definer set search_path = public as $$
declare t public.homework_attempts;
begin
 t := public.hw_attempt_for(p_token);
 if t.finished_at is not null or not exists(select 1 from public.homework_items where id=p_item and assignment_id=t.assignment_id and config->'block'->>'completion'='recording') then raise exception 'not_found'; end if;
 if exists(select 1 from public.homework_item_attempts where attempt_id=t.id and item_id=p_item and finished_at is not null) then raise exception 'closed'; end if;
 if (select count(*) from storage.objects where bucket_id='homework-recordings' and name like t.id::text || '/' || p_item::text || '/%') >= 10 then raise exception 'upload_limit'; end if;
 return t.id::text || '/' || p_item::text || '/' || gen_random_uuid()::text;
end $$;
create function public.hw_recording_access(p_path text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare a uuid := public.hw_staff_academy(); c uuid;
begin
 select h.class_id into c from public.homework_attempts t join public.homework_assignments h on h.id=t.assignment_id join public.homework_item_attempts ia on ia.attempt_id=t.id where h.academy_id=a and ia.meta->>'recording'=p_path;
 if c is null then return false; end if;
 perform public.hw_block_academy(c); return true;
end $$;

-- No scheduled deletion is enabled automatically. An operator can run the dry-run cleanup tool.
create function public.hw_recording_cleanup_candidates() returns jsonb
language sql stable security definer set search_path = public,storage as $$
 select coalesce(jsonb_agg(o.name),'[]') from storage.objects o where o.bucket_id='homework-recordings'
 and (o.created_at < now()-interval '180 days' or (o.created_at < now()-interval '24 hours' and not exists(select 1 from public.homework_item_attempts ia where ia.meta->>'recording'=o.name)))
$$;
revoke all on function public.hw_recording_cleanup_candidates() from public,anon,authenticated;
grant execute on function public.hw_recording_cleanup_candidates() to service_role;

revoke all on function public.hw_block_academy(uuid), public.hw_validate_items(jsonb,boolean) from public,anon,authenticated;
revoke all on function public.hw_recording_target(uuid,uuid) from public,anon,authenticated;
grant execute on function public.hw_recording_target(uuid,uuid) to service_role;
revoke all on function public.hw_drafts(uuid), public.hw_save_draft(uuid,jsonb), public.hw_assign_draft(uuid,jsonb,uuid[],timestamptz,uuid), public.hw_block_results(uuid), public.hw_review_block(uuid,uuid), public.hw_recording_access(text) from public,anon;
grant execute on function public.hw_drafts(uuid), public.hw_save_draft(uuid,jsonb), public.hw_assign_draft(uuid,jsonb,uuid[],timestamptz,uuid), public.hw_block_results(uuid), public.hw_review_block(uuid,uuid), public.hw_recording_access(text) to authenticated;
revoke all on function public.hw_create_v2(uuid,text,jsonb,uuid[],timestamptz,text,uuid,jsonb) from public,anon;
grant execute on function public.hw_create_v2(uuid,text,jsonb,uuid[],timestamptz,text,uuid,jsonb) to authenticated;
revoke all on function public.hw_submit(uuid,uuid,int,text,uuid,int), public.hw_progress(uuid,uuid,text,jsonb,uuid) from public;
grant execute on function public.hw_submit(uuid,uuid,int,text,uuid,int), public.hw_progress(uuid,uuid,text,jsonb,uuid) to anon,authenticated;
commit;
