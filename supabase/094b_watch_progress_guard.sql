-- 094b: 영상 보기 활동(config.watch)은 093 시청 기록이 있으면 목표 횟수를 다 채워야 끝낼 수 있다(서버가 막는다).
-- 시청 기록이 하나도 없으면(오프라인·옛 앱) 예전처럼 영상 끝으로 끝난다. 087 의 hw_progress 본문에 이 검사만 더했다.

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
 if p_event = 'item_complete' and coalesce(i.config->>'watch','') = 'true'
    and exists(select 1 from public.homework_watch_views w where w.attempt_id=t.id and w.item_id=i.id)
    and (select count(*) from public.homework_watch_views w where w.attempt_id=t.id and w.item_id=i.id and w.completed_at is not null) < greatest(1,least(coalesce((i.config->>'targetViews')::int,1),10))
   then raise exception 'incomplete'; end if;
 r := public.hw_progress_before_blocks(p_token,p_item_id,p_event,p_meta,p_client_id);
 if b is not null then update public.homework_item_attempts set meta=meta || m where attempt_id=t.id and item_id=i.id; end if;
 return r;
end $$;
