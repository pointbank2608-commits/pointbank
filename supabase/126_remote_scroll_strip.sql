-- Apply before deploying the phone scroll strip.
begin;

alter table public.remote_sessions add column scroll jsonb;

create function public.remote_qr_scroll(p_id uuid, p_key uuid, p_delta integer, p_step integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_delta is null or p_delta = 0 or p_delta not between -1000 and 1000
    or p_step is null or p_step < 0 then
    return false;
  end if;

  -- The cumulative total preserves motion when a Realtime update is missed.
  update public.remote_sessions r set scroll = jsonb_build_object(
      'seq', coalesce((r.scroll->>'seq')::bigint, 0) + 1,
      'step', p_step,
      'total', p_delta + case when r.scroll->>'step' = p_step::text
                             then (r.scroll->>'total')::bigint else 0 end
    )
  where r.id = (private.classbank_remote_pair(p_id, p_key)).id
    and r.state->>'ended' = 'false'
    and r.state->>'scrollEnabled' = 'true'
    and r.state->>'stepIndex' = p_step::text;
  return found;
end;
$$;

revoke all on function public.remote_qr_scroll(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.remote_qr_scroll(uuid, uuid, integer, integer) to anon;

notify pgrst, 'reload schema';
commit;
