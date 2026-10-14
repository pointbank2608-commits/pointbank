-- 075 확인(읽기 전용): 모두 true 여야 한다
select
  exists (select 1 from pg_proc where proname = 'admin_academies_features') as list_fn,
  exists (select 1 from pg_proc where proname = 'admin_set_features_bulk') as bulk_fn,
  has_function_privilege('authenticated', 'public.admin_academies_features()', 'execute') as list_grant,
  has_function_privilege('authenticated', 'public.admin_set_features_bulk(boolean, boolean, uuid)', 'execute') as bulk_grant,
  not has_function_privilege('anon', 'public.admin_set_features_bulk(boolean, boolean, uuid)', 'execute') as bulk_not_anon;
