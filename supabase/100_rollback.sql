-- Stop admin research only. Preserve decisions, evidence, student learning and collection.
begin;
revoke all on function public.admin_learning_research(int,uuid),public.admin_learning_research_decide(uuid,int,uuid,text,text,text,text),public.admin_learning_research_decisions(int,uuid) from public,anon,authenticated;
commit;
