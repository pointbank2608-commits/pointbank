-- MANUAL ROLLBACK ONLY. Backup first. Do not execute together with forward migration.
-- Retains drafts, assignment snapshots, answers, audio bucket and block columns.
-- Revert the app first; existing block assignments require the new player and should be closed, not deleted.
begin;
drop trigger homework_block_snapshot_frozen on public.homework_items;
revoke execute on function public.hw_create_once(uuid,uuid,text,jsonb,uuid[],timestamptz,text,uuid,jsonb) from authenticated,anon,service_role;
drop function public.hw_finish(uuid);
alter function public.hw_finish_before_blocks(uuid) rename to hw_finish;
grant execute on function public.hw_finish(uuid) to anon,authenticated;
drop function public.hw_create_v2(uuid,text,jsonb,uuid[],timestamptz,text,uuid,jsonb);
alter function public.hw_create_v2_before_blocks(uuid,text,jsonb,uuid[],timestamptz,text,uuid,jsonb) rename to hw_create_v2;
grant execute on function public.hw_create_v2(uuid,text,jsonb,uuid[],timestamptz,text,uuid,jsonb) to authenticated;
drop function public.hw_submit(uuid,uuid,int,text,uuid,int);
alter function public.hw_submit_before_blocks(uuid,uuid,int,text,uuid,int) rename to hw_submit;
grant execute on function public.hw_submit(uuid,uuid,int,text,uuid,int) to anon,authenticated;
drop function public.hw_progress(uuid,uuid,text,jsonb,uuid);
alter function public.hw_progress_before_blocks(uuid,uuid,text,jsonb,uuid) rename to hw_progress;
grant execute on function public.hw_progress(uuid,uuid,text,jsonb,uuid) to anon,authenticated;
drop function public.hw_public_item(public.homework_items);
alter function public.hw_public_item_before_blocks(public.homework_items) rename to hw_public_item;
-- Disable new entry points while retaining data for recovery.
revoke execute on function public.hw_drafts(uuid),public.hw_save_draft(uuid,jsonb),public.hw_assign_draft(uuid,jsonb,uuid[],timestamptz,uuid),public.hw_recording_target(uuid,uuid),public.hw_recording_access(text),public.hw_block_results(uuid),public.hw_review_block(uuid,uuid) from authenticated,anon,service_role;
commit;
