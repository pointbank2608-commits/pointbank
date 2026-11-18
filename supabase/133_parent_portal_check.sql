-- Read-only smoke checks after 133_parent_portal.sql. All values should be true.
select
  not has_table_privilege('anon','public.parent_sessions','select')
    and not has_table_privilege('authenticated','public.parent_accounts','select')
    and not has_table_privilege('authenticated','public.parent_invites','select')
    and not has_table_privilege('anon','public.parent_homework_rows','select')
    and not has_table_privilege('authenticated','public.parent_push_devices','select')
    and not has_table_privilege('anon','public.parent_push_queue','select') as data_private,
  not has_function_privilege('anon','public.parent_make_invite(uuid)','execute')
    and not has_function_privilege('anon','public.parent_save_account(uuid,text,text,boolean)','execute')
    and has_function_privilege('authenticated','public.parent_make_invite(uuid)','execute') as invite_staff_only,
  not has_function_privilege('anon','public.parent_claim_push()','execute')
    and not has_function_privilege('authenticated','public.parent_claim_push()','execute')
    and has_function_privilege('service_role','public.parent_claim_push()','execute') as worker_private,
  has_function_privilege('anon','public.parent_home(text,text)','execute')
    and not has_function_privilege('anon','public.parent_resolve(text)','execute') as token_resolver_private,
  (select count(*) = 7 from pg_trigger where not tgisinternal and
    tgfoid = 'public.parent_queue_event()'::regprocedure) as transition_triggers_ready;
