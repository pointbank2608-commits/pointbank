-- Apply before deploying the touchpad client. Coordinates are in thousandths of the board viewport.
begin;

alter table public.remote_sessions add column pointer jsonb;

create function public.remote_qr_move_pointer(p_id uuid, p_key uuid, p_dx integer, p_dy integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_dx is null or p_dy is null or p_dx not between -1000 and 1000 or p_dy not between -1000 and 1000
    or (p_dx = 0 and p_dy = 0) then
    return false;
  end if;

  -- Keep pointer movement independent of slide commands and the board heartbeat.
  update public.remote_sessions r set pointer = jsonb_build_object(
    'seq', coalesce((r.pointer->>'seq')::bigint, 0) + 1,
    'x', greatest(0, least(1000, coalesce((r.pointer->>'x')::int, 500) + p_dx)),
    'y', greatest(0, least(1000, coalesce((r.pointer->>'y')::int, 500) + p_dy))
  )
  where r.id = (private.classbank_remote_pair(p_id, p_key)).id
    and r.state->>'ended' = 'false' and r.state->>'pointerEnabled' = 'true';
  return found;
end;
$$;

revoke all on function public.remote_qr_move_pointer(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.remote_qr_move_pointer(uuid, uuid, integer, integer) to anon;

notify pgrst, 'reload schema';
commit;
