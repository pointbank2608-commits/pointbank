-- 112 적용 확인(읽기 전용). 6개 행이 모두 true 여야 한다.
select 'table' as item, to_regclass('public.homework_spelling_hints') is not null as ok
union all select 'rls', coalesce((select relrowsecurity from pg_class where oid='public.homework_spelling_hints'::regclass),false)
union all select 'hint_rpc', to_regprocedure('public.hw_spelling_hint(uuid,uuid,integer,integer)') is not null
union all select 'summary', to_regprocedure('public.hw_spelling_summary(public.homework_items,uuid,uuid)') is not null
union all select 'public_item_strips_settings', pg_get_functiondef('public.hw_public_item(public.homework_items)'::regprocedure) like '%spellingHints%'
union all select 'results_has_hints', pg_get_functiondef('public.hw_block_results(uuid)'::regprocedure) like '%hw_spelling_summary%';

-- 되돌리기(문제가 생겼을 때만): 힌트 요청·표시를 끄고 기존 동작으로 돌아간다. 기록 표는 남긴다.
-- revoke execute on function public.hw_spelling_hint(uuid,uuid,integer,integer) from anon, authenticated;
