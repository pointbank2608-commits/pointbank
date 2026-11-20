-- Read-only checks after 135. All fields must be true.
select
  not has_table_privilege('anon','public.parent_feedback','select')
    and not has_table_privilege('authenticated','public.parent_updates','select')
    and not has_table_privilege('anon','public.parent_login_failures','select') as private_data,
  has_function_privilege('anon','public.parent_login(text,text)','execute')
    and not has_function_privilege('anon','public.parent_login_key(text,text)','execute')
    and not has_function_privilege('anon','public.parent_home_v133(text,text)','execute') as login_boundary,
  not has_function_privilege('anon','public.parent_publish_feedback(uuid,text,uuid)','execute')
    and has_function_privilege('authenticated','public.parent_publish_feedback(uuid,text,uuid)','execute') as feedback_staff_only,
  not exists(select 1 from public.parent_accounts where login_key is null) as login_backfill,
  (select count(*)=7 from pg_trigger where not tgisinternal and tgname in
    ('parent_account_login_key','parent_update_published','parent_attendance_update',
     'parent_attendance_delete','parent_feedback_update','parent_word_day_update',
     'parent_checked_homework_update')) as triggers_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='attendance'
    and column_name='check_in_kind') as attendance_mode;
