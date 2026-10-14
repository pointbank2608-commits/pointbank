-- 074 확인(읽기 전용): 모두 true 여야 한다
select
  exists (select 1 from information_schema.columns where table_name = 'academies' and column_name = 'features') as features_column,
  exists (select 1 from pg_proc where proname = 'academy_feature') as helper_fn,
  exists (select 1 from pg_proc where proname = 'admin_set_academy_features') as admin_set_fn,
  exists (select 1 from pg_proc where proname = 'admin_academy_features') as admin_get_fn,
  has_function_privilege('authenticated', 'public.admin_set_academy_features(uuid, boolean, boolean, boolean)', 'execute') as admin_set_grant,
  not has_function_privilege('anon', 'public.admin_set_academy_features(uuid, boolean, boolean, boolean)', 'execute') as admin_set_not_anon,
  (select count(*) from public.academies where features = '{}'::jsonb) = 0 as all_backfilled;

-- 참고(직접 실행): 내 학원만 열어 두고 나머지 학원은 개별수업·숙제를 닫으려면
--   update public.academies set features = '{"group": true, "solo": false, "homework": false}'::jsonb
--    where id <> '<내 학원 id>';
-- (관리자 화면의 학원 상세에서 학원마다 켜고 끌 수도 있다.)
