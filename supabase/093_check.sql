-- 093 확인(읽기 전용): 표 2개와 함수 3개가 있고, 표는 RLS 가 켜져 있어야 한다.
select 'tables' as what, count(*) as n from information_schema.tables
 where table_schema = 'public' and table_name in ('homework_watch_views', 'video_ad_flags');
select 'rls' as what, relname, relrowsecurity from pg_class
 where relname in ('homework_watch_views', 'video_ad_flags');
select 'functions' as what, proname from pg_proc
 where pronamespace = 'public'::regnamespace and proname in ('hw_watch_report', 'hw_watch_state', 'hw_watch_summary');
