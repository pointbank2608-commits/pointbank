select
  (select count(*)=4 and bool_and(relrowsecurity) from pg_class
    where oid in ('public.learning_vocab_cue_plans'::regclass,'public.learning_vocab_cue_states'::regclass,
      'public.learning_vocab_cue_actions'::regclass,'public.learning_vocab_class_schedules'::regclass)) as cue_rls,
  not has_table_privilege('anon','public.learning_vocab_cue_actions','SELECT')
    and not has_table_privilege('authenticated','public.learning_vocab_cue_states','SELECT') as cue_private,
  not has_function_privilege('anon','public.learning_vocab_cue_feedback(uuid,uuid)','EXECUTE')
    and has_function_privilege('authenticated','public.learning_vocab_cue_feedback(uuid,uuid)','EXECUTE')
    and has_function_privilege('authenticated','public.learning_vocab_cue_approve(uuid,uuid,uuid[],text,jsonb,text[],boolean,uuid,timestamptz,jsonb,boolean)','EXECUTE')
    and has_function_privilege('authenticated','public.learning_vocab_cue_approve_scheduled(uuid,uuid,uuid[],text,jsonb,text[],boolean,uuid,timestamptz,jsonb,boolean,jsonb)','EXECUTE')
    and not has_function_privilege('anon','public.learning_vocab_schedule_read(uuid)','EXECUTE')
    and not has_table_privilege('authenticated','public.learning_vocab_class_schedules','SELECT')
    as teacher_access,
  has_function_privilege('anon','public.learning_vocab_cue_open(uuid,uuid)','EXECUTE')
    and has_function_privilege('anon','public.learning_vocab_cue_action(uuid,uuid,uuid,integer,text,text)','EXECUTE')
    and has_function_privilege('anon','public.student_home_with_vocab_schedule(uuid)','EXECUTE')
    as student_access,
  (select count(*)=3 from pg_trigger where not tgisinternal and tgenabled='O'
    and tgname in ('learning_vocab_cue_guard_approval','learning_vocab_cue_guard_legacy','learning_vocab_cue_index_run'))
    as cue_guards,
  cardinality(public.learning_path_compat_problems())=0 as legacy_guards_intact;
