-- Pause the teacher pilot. Students keep access to already approved plans.
begin;
revoke execute on function public.learning_vocab_feedback(uuid,uuid),public.learning_vocab_draft(uuid,text,uuid),
  public.learning_vocab_dismiss(uuid),public.learning_vocab_approve(uuid,uuid,uuid[],text,jsonb,text,boolean,uuid,timestamptz)
  from authenticated;
commit;
