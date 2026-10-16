-- 084a 확인(읽기 전용): schedule 칸이 있으면 1행이 나온다.
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'classes' and column_name = 'schedule';
