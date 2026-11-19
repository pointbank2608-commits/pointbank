-- Read-only checks after 136. All fields should be true.
select
  not has_table_privilege('anon','public.student_info_requests','select')
    and not has_table_privilege('authenticated','public.student_info_requests','select') as request_records_private,
  not has_function_privilege('anon','public.student_save_info(uuid,uuid,uuid,text,text,boolean,text,text,boolean)','execute')
    and has_function_privilege('authenticated','public.student_save_info(uuid,uuid,uuid,text,text,boolean,text,text,boolean)','execute') as staff_save_only,
  has_function_privilege('anon','public.parent_set_family_push(text[],text,boolean,text,text,text)','execute') as family_push_available;
