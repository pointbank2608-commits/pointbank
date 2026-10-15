-- 083 확인(읽기 전용)
select
  exists (select 1 from pg_proc where proname = 'admin_academy_search') as search_fn,
  exists (select 1 from pg_proc where proname = 'admin_totals') as totals_fn,
  exists (select 1 from pg_proc where proname = 'admin_today_lists') as today_fn,
  exists (select 1 from pg_proc where proname = 'admin_academies_features_for') as features_fn;
