-- Stop new plans and recommendation approvals, preserve existing students' learning/check schedules and all records.
begin;
revoke execute on function public.learning_path_assign(uuid,uuid,uuid[],text,jsonb,text),public.learning_path_feedback(uuid,int,text,uuid,text) from authenticated;
commit;
