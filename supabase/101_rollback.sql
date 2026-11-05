-- Stop new adaptive homework only. Keep already-approved learning, evidence and metadata.
begin;
revoke execute on function public.learning_homework_assign(uuid,uuid,uuid[],text,jsonb,text,int,timestamptz,text,uuid) from authenticated;
commit;
