select to_regclass('public.learning_research_decisions') is not null as decision_history_exists,
  (select relrowsecurity from pg_class where oid='public.learning_research_decisions'::regclass) as history_rls,
  not has_table_privilege('anon','public.learning_research_decisions','SELECT')
    and not has_table_privilege('authenticated','public.learning_research_decisions','SELECT') as history_private,
  not has_function_privilege('anon','public.admin_learning_research(int,uuid)','EXECUTE') as anon_cannot_read,
  has_function_privilege('authenticated','public.admin_learning_research(int,uuid)','EXECUTE') as signed_in_rpc_available,
  not has_function_privilege('anon','public.admin_learning_research_decide(uuid,int,uuid,text,text,text,text)','EXECUTE') as anon_cannot_decide;
-- Also exercise the RPC with actual admin/non-admin roles; grants alone are not authorization.
