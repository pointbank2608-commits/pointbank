-- Read-only installation check; never creates sample teacher data.
select
  to_regprocedure('public.classbank_optional_activity_name()') is not null as name_function,
  exists(select 1 from pg_trigger where tgname='game_templates_optional_name' and not tgisinternal) as game_name_trigger,
  exists(select 1 from pg_trigger where tgname='word_lists_optional_name' and not tgisinternal) as material_name_trigger,
  exists(select 1 from pg_proc where oid=to_regprocedure('public.classbank_optional_activity_name()') and not prosecdef) as invoker_permissions;
