-- Keep the frozen receipt proportional to the activity actually delivered.
begin;

-- Refuse to replace a newer deployed homework/solo delivery implementation.
do $check$
declare fingerprint text;
begin
  select md5(replace(p.prosrc, chr(13) || chr(10), chr(10))) into fingerprint
    from pg_proc p where p.oid = to_regprocedure('public.learning_run_open(text,text,uuid)');
  if fingerprint is null or fingerprint not in ('48c28febfd4c2c84ec77d481b7c11310', '409cff58584b8b226f9b6df2f7be4c04') then
    raise exception 'word_project_delivery_base_changed';
  end if;
end $check$;

create or replace function public.learning_run_open(p_source text,p_credential text,p_resource uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.solo_assignments; h public.homework_attempts; wt public.wm_targets; ws public.wm_sessions;
  result jsonb; private jsonb; item public.homework_items; public_item jsonb; r uuid; runs jsonb:='{}'; ac uuid; frozen jsonb;
begin
  if p_source='solo' then
    a:=public.solo_assignment_for(p_credential::uuid,p_resource);
    perform 1 from public.solo_assignments where id=a.id for update;
    select jsonb_build_object('steps',l.steps) into private from public.solo_lessons l where id=a.lesson_id for share;
    result:=public.solo_open(p_credential::uuid,p_resource);
    if result ? 'error' then return result; end if;
    select s.definition into frozen from public.learning_solo_versions v join public.learning_sensor_snapshots s on s.id=v.snapshot_id where v.assignment_id=a.id;
    if frozen is not null then
      private:=frozen->'grading';
      result:=result||jsonb_build_object('steps',frozen->'delivered'->'steps');
    end if;
    r:=public.learning_delivery_record('solo',a.academy_id,a.student_id,a.id,private,jsonb_build_object('steps',result->'steps'));
    insert into public.learning_solo_versions(assignment_id,snapshot_id) select a.id,snapshot_id from public.learning_delivery_runs where id=r on conflict do nothing;
    return result||jsonb_build_object('sensor_run_id',r);
  elsif p_source='homework' then
    h:=public.hw_attempt_for(p_credential::uuid,true);
    select academy_id into ac from public.homework_assignments where id=h.assignment_id;
    perform 1 from public.homework_items where assignment_id=h.assignment_id order by id for share;
    result:=public.hw_state(p_credential::uuid);
    for item in select * from public.homework_items where assignment_id=h.assignment_id order by position loop
      select x into public_item from jsonb_array_elements(result->'items') x where x->>'id'=item.id::text;
      if public_item is null then continue; end if;
      private:=jsonb_build_object('config',item.config,'content',item.content);
      r:=public.learning_delivery_record('homework',ac,h.student_id,item.id,private,public_item);
      runs:=runs||jsonb_build_object(item.id::text,r);
    end loop;
    return result||jsonb_build_object('sensor_runs',runs);
  elsif p_source='word_memory' then
    wt:=public.wm_target_for(p_credential);
    result:=public.wm_today_state(p_credential);
    if result->>'session_id' is null then return result; end if;
    select * into ws from public.wm_sessions where id=(result->>'session_id')::uuid and target_id=wt.id for update;
    if ws.id is null then raise exception 'not_found'; end if;
    -- Re-read under the session lock so the receipt describes the payload actually returned.
    result:=public.wm_today_state(p_credential);
    if result->>'session_id' is distinct from ws.id::text then raise exception 'stale'; end if;
    select p.academy_id,jsonb_build_object('questions',ws.questions,'rule_version',p.rule_version,'cards',
      case when p.rule_version = 'wm-v2' then coalesce((
        select jsonb_agg(c order by n)
        from jsonb_array_elements(p.cards) with ordinality as pool(c,n)
        where exists (select 1 from jsonb_array_elements(ws.questions) q where q->>'key'=c->>'key')
      ), '[]'::jsonb) else p.cards end)
      into ac,private from public.wm_plans p where id=wt.plan_id;
    r:=public.learning_delivery_record('word_memory',ac,wt.student_id,ws.id,private,jsonb_build_object('items',result->'items'));
    return result||jsonb_build_object('sensor_run_id',r);
  end if;
  raise exception 'bad_run_source';
end $$;

commit;
