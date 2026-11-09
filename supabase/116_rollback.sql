-- Pause new cue approvals. Existing cue lessons, teacher feedback and evidence stay available.
begin;
revoke execute on function public.learning_vocab_cue_approve(uuid,uuid,uuid[],text,jsonb,text[],boolean,uuid,timestamptz,jsonb,boolean),
  public.learning_vocab_cue_approve_scheduled(uuid,uuid,uuid[],text,jsonb,text[],boolean,uuid,timestamptz,jsonb,boolean,jsonb),
  public.learning_vocab_schedule_save(uuid,int,int[],int[]),public.learning_vocab_cue_draft(uuid,text,uuid) from authenticated;
commit;
