-- 086s: 대량 변경 적용 · 실패 항목 재처리 · 되돌리기
-- 적용: 미리보기 묶음 번호만 받는다. 1시간이 지난 미리보기는 거절(그 사이 대상이 바뀌었을 수 있다). 사유 필수.
--   이미 적용된(done) 묶음에 다시 호출하면 아무것도 하지 않고 결과만 돌려준다(중복 실행 방지). partial 이면 실패한 항목만 다시 한다.
-- 되돌리기: 적용 뒤 그 학원의 기능이 다른 사람에 의해 또 바뀌었으면 건너뛴다(undo_skipped) — 나중 변경을 덮어쓰지 않는다.

create or replace function public.admin_bulk_apply(p_batch uuid, p_reason text)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_b public.admin_bulk_batches;
  r record;
  v_ok int;
  v_fail int;
begin
  if not public.is_platform_admin() then raise exception 'not_allowed'; end if;
  if p_reason is null or length(trim(p_reason)) < 2 then raise exception '변경 사유를 적어 주세요.'; end if;
  select * into v_b from public.admin_bulk_batches where id = p_batch for update;
  if v_b.id is null then raise exception '묶음을 찾을 수 없어요.'; end if;
  if v_b.status in ('done', 'undone', 'running') then
    return jsonb_build_object('batch_id', v_b.id, 'status', v_b.status, 'ok', v_b.ok_count, 'failed', v_b.failed_count, 'repeat', true);
  end if;
  if v_b.status = 'previewed' and v_b.created_at < now() - interval '1 hour' then raise exception '미리보기가 오래됐어요. 다시 미리보기를 만들어 주세요.'; end if;

  update public.admin_bulk_batches set status = 'running', reason = trim(p_reason) where id = p_batch;
  for r in select * from public.admin_bulk_items where batch_id = p_batch and status in ('pending', 'failed') loop
    begin
      update public.academies set features = r.after where id = r.academy_id;
      update public.admin_bulk_items set status = 'ok', error = null where batch_id = p_batch and academy_id = r.academy_id;
    exception when others then
      update public.admin_bulk_items set status = 'failed', error = left(sqlerrm, 200) where batch_id = p_batch and academy_id = r.academy_id;
    end;
  end loop;
  select count(*) filter (where status = 'ok'), count(*) filter (where status = 'failed') into v_ok, v_fail from public.admin_bulk_items where batch_id = p_batch;
  update public.admin_bulk_batches
     set status = case when v_fail = 0 then 'done' else 'partial' end, ok_count = v_ok, failed_count = v_fail, applied_at = now()
   where id = p_batch;
  insert into public.admin_actions (action, reason, batch_id, result, before, after, detail)
  values ('bulk_features', trim(p_reason), p_batch, case when v_fail = 0 then 'success' when v_ok = 0 then 'failed' else 'partial' end,
          jsonb_build_object('scope', v_b.scope), jsonb_build_object('params', v_b.params, 'ok', v_ok, 'failed', v_fail), jsonb_build_object('targets', v_b.target_count));
  return jsonb_build_object('batch_id', p_batch, 'status', case when v_fail = 0 then 'done' else 'partial' end, 'ok', v_ok, 'failed', v_fail, 'repeat', false);
end $$;

create or replace function public.admin_bulk_undo(p_batch uuid, p_reason text)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_b public.admin_bulk_batches;
  r record;
  v_cur jsonb;
  v_back int := 0;
  v_skip int := 0;
begin
  if not public.is_platform_admin() then raise exception 'not_allowed'; end if;
  if p_reason is null or length(trim(p_reason)) < 2 then raise exception '되돌리는 사유를 적어 주세요.'; end if;
  select * into v_b from public.admin_bulk_batches where id = p_batch for update;
  if v_b.id is null or v_b.status not in ('done', 'partial') then raise exception '되돌릴 수 있는 묶음이 아니에요.'; end if;
  for r in select * from public.admin_bulk_items where batch_id = p_batch and status = 'ok' loop
    v_cur := jsonb_build_object('group', public.academy_feature(r.academy_id, 'group'), 'solo', public.academy_feature(r.academy_id, 'solo'), 'homework', public.academy_feature(r.academy_id, 'homework'));
    if v_cur = r.after then
      update public.academies set features = r.before where id = r.academy_id;
      update public.admin_bulk_items set status = 'undone' where batch_id = p_batch and academy_id = r.academy_id;
      v_back := v_back + 1;
    else
      update public.admin_bulk_items set status = 'undo_skipped', error = '그 뒤에 다시 바뀌어 건너뛰었어요' where batch_id = p_batch and academy_id = r.academy_id;
      v_skip := v_skip + 1;
    end if;
  end loop;
  update public.admin_bulk_batches set status = 'undone', undone_at = now() where id = p_batch;
  insert into public.admin_actions (action, reason, batch_id, result, after)
  values ('bulk_features_undo', trim(p_reason), p_batch, case when v_skip = 0 then 'success' else 'partial' end, jsonb_build_object('restored', v_back, 'skipped', v_skip));
  return jsonb_build_object('restored', v_back, 'skipped', v_skip);
end $$;

-- 최근 묶음 목록(되돌리기·재처리용)
create or replace function public.admin_bulk_recent(p_limit int default 20)
returns table (id uuid, kind text, status text, scope jsonb, params jsonb, target_count int, changed_count int, ok_count int, failed_count int,
               reason text, created_at timestamptz, applied_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select b.id, b.kind, b.status, b.scope, b.params, b.target_count, b.changed_count, b.ok_count, b.failed_count, b.reason, b.created_at, b.applied_at
    from public.admin_bulk_batches b where public.is_platform_admin() and b.status <> 'previewed'
   order by b.created_at desc limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.admin_bulk_apply(uuid, text) from public, anon;
revoke all on function public.admin_bulk_undo(uuid, text) from public, anon;
revoke all on function public.admin_bulk_recent(int) from public, anon;
grant execute on function public.admin_bulk_apply(uuid, text) to authenticated;
grant execute on function public.admin_bulk_undo(uuid, text) to authenticated;
grant execute on function public.admin_bulk_recent(int) to authenticated;
