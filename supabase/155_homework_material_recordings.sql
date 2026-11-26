-- Preserve the private per-attempt/per-item storage scope. A retransmitted take
-- resolves to the same object even if its first upload response was lost.
begin;
create or replace function public.hw_recording_seconds(b jsonb) returns numeric
language sql immutable set search_path = public as $$
  select case when b->>'method' in ('material:dub','material:shadow')
    then least(1205, greatest(120, ceil((b->>'end')::numeric - (b->>'start')::numeric) + 5))
    else 120 end;
$$;
revoke all on function public.hw_recording_seconds(jsonb) from public,anon,authenticated;

create or replace function public.hw_recording_target_v2(p_token uuid,p_item uuid,p_digest text) returns jsonb
language plpgsql security definer set search_path = public,storage as $$
declare t public.homework_attempts; b jsonb; prefix text; path text; stored boolean;
begin
  if p_digest is null or p_digest !~ '^[0-9a-f]{64}$' then raise exception 'bad_recording'; end if;
  t := public.hw_attempt_for(p_token);
  select config->'block' into b from public.homework_items
    where id=p_item and assignment_id=t.assignment_id and config->'block'->>'completion'='recording';
  if not found or t.finished_at is not null then raise exception 'not_found'; end if;
  if exists(select 1 from public.homework_item_attempts where attempt_id=t.id and item_id=p_item and finished_at is not null)
    then raise exception 'closed'; end if;
  prefix := t.id::text || '/' || p_item::text || '/';
  path := prefix || p_digest;
  select exists(select 1 from storage.objects where bucket_id='homework-recordings' and name=path) into stored;
  if not stored and (select count(*) from storage.objects where bucket_id='homework-recordings' and name like prefix || '%') >= 10
    then raise exception 'upload_limit'; end if;
  return jsonb_build_object('path',path,'stored',stored,'limit',public.hw_recording_seconds(b));
end $$;
revoke all on function public.hw_recording_target_v2(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.hw_recording_target_v2(uuid,uuid,text) to service_role;

create or replace function public.hw_progress(p_token uuid,p_item_id uuid,p_event text,p_meta jsonb,p_client_id uuid) returns jsonb
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
   if b->>'method' in ('material:shadow','material:dub','material:echo') and p_meta->'watched' is distinct from 'true'::jsonb then raise exception 'incomplete'; end if;
   if b->>'method' in ('material:learn','material:sceneWords') and p_meta->'meaningSeen' is distinct from 'true'::jsonb then raise exception 'incomplete'; end if;
   if b->>'completion' = 'review' and (length(trim(coalesce(p_meta->>'response',''))) = 0 or length(p_meta->>'response')>2000) then raise exception 'incomplete'; end if;
   if b->>'completion' = 'recording' then
     path := p_meta->>'recording';
     if path is null or path not like t.id::text || '/' || i.id::text || '/%' or not exists(select 1 from storage.objects where bucket_id='homework-recordings' and name=path) then raise exception 'incomplete'; end if;
     if jsonb_typeof(p_meta->'duration') is distinct from 'number' or (p_meta->>'duration')::numeric not between 0.5 and public.hw_recording_seconds(b) then raise exception 'bad_recording'; end if;
     if not exists(select 1 from storage.objects o where o.bucket_id='homework-recordings' and o.name=path and (o.user_metadata->>'duration')::numeric between 0.5 and public.hw_recording_seconds(b)+0.25) then raise exception 'bad_recording'; end if;
   end if;
   m := jsonb_build_object('response',left(p_meta->>'response',2000),'recording',path,
     'duration',p_meta->'duration','hints',greatest(0,least(coalesce((p_meta->>'hints')::int,0),10000)),
     'listens',greatest(0,least(coalesce((p_meta->>'listens')::int,0),10000)),
     'watched',b->>'type'='video' or coalesce(b->>'method','') in ('material:shadow','material:dub','material:echo'),'review',case when b->>'completion' in ('review','recording') then 'pending' else 'none' end);
   if b->>'method' like 'material:%' and b->>'completion'='recording' then
     -- A device's recognition status is an observation, never a server-graded answer.
     m := m || jsonb_build_object('recordingCheck',case when p_meta->>'recordingCheck' in
       ('matched','different','unrecognized','unavailable') then p_meta->>'recordingCheck' else 'unavailable' end);
   end if;
 end if;
 if p_event = 'item_complete' and coalesce(i.config->>'watch','') = 'true'
    and exists(select 1 from public.homework_watch_views w where w.attempt_id=t.id and w.item_id=i.id)
    and (select count(*) from public.homework_watch_views w where w.attempt_id=t.id and w.item_id=i.id and w.completed_at is not null) < greatest(1,least(coalesce((i.config->>'targetViews')::int,1),10))
   then raise exception 'incomplete'; end if;
 r := public.hw_progress_before_blocks(p_token,p_item_id,p_event,p_meta,p_client_id);
 if b is not null then update public.homework_item_attempts set meta=meta || m where attempt_id=t.id and item_id=i.id; end if;
 return r;
end $$;
commit;
