select
  (select count(*)=2 and bool_and(relrowsecurity) from pg_class
    where oid in ('public.learning_vocab_drafts'::regclass,'public.learning_vocab_approvals'::regclass)) as vocab_rls,
  not has_table_privilege('authenticated','public.learning_vocab_drafts','SELECT')
    and not has_table_privilege('anon','public.learning_vocab_approvals','SELECT') as private_draft_data,
  not has_function_privilege('anon','public.learning_vocab_feedback(uuid,uuid)','EXECUTE')
    and has_function_privilege('authenticated','public.learning_vocab_feedback(uuid,uuid)','EXECUTE')
    and not has_function_privilege('authenticated','public.learning_vocab_rows(uuid)','EXECUTE') as teacher_feedback,
  not has_function_privilege('anon','public.learning_vocab_approve(uuid,uuid,uuid[],text,jsonb,text,boolean,uuid,timestamptz)','EXECUTE')
    and has_function_privilege('authenticated','public.learning_vocab_approve(uuid,uuid,uuid[],text,jsonb,text,boolean,uuid,timestamptz)','EXECUTE') as teacher_approval,
  cardinality(public.learning_path_compat_problems())=0 as legacy_guards_intact,
  has_function_privilege('anon','public.learning_path_action(uuid,uuid,uuid,integer,text,text)','EXECUTE')
    and position('meaning-balloon-v1' in pg_get_functiondef('public.learning_path_action(uuid,uuid,uuid,integer,text,text)'::regprocedure))>0
    and position('vocab_game' in pg_get_functiondef('public.learning_path_payload(uuid)'::regprocedure))>0 as game_path_installed;
