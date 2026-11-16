-- Apply before deploying the remote click controls.
begin;

create or replace function public.remote_qr_move_pointer(p_id uuid, p_key uuid, p_dx integer, p_dy integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_dx is null or p_dy is null or p_dx not between -1000 and 1000 or p_dy not between -1000 and 1000
    or (p_dx = 0 and p_dy = 0) then
    return false;
  end if;

  update public.remote_sessions r set pointer = coalesce(r.pointer, '{}'::jsonb) || jsonb_build_object(
    'seq', coalesce((r.pointer->>'seq')::bigint, 0) + 1,
    'x', greatest(0, least(1000, coalesce((r.pointer->>'x')::int, 500) + p_dx)),
    'y', greatest(0, least(1000, coalesce((r.pointer->>'y')::int, 500) + p_dy))
  )
  where r.id = (private.classbank_remote_pair(p_id, p_key)).id
    and r.state->>'ended' = 'false' and r.state->>'pointerEnabled' = 'true';
  return found;
end;
$$;

create function public.remote_qr_click_pointer(p_id uuid, p_key uuid, p_count integer, p_step integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_count is null or p_count not in (1, 2) or p_step is null or p_step < 0 then
    return false;
  end if;

  update public.remote_sessions r set pointer = r.pointer || jsonb_build_object('click', jsonb_build_object(
    'seq', coalesce((r.pointer->'click'->>'seq')::bigint, 0) + 1,
    'x', (r.pointer->>'x')::integer,
    'y', (r.pointer->>'y')::integer,
    'count', p_count,
    'step', p_step
  ))
  where r.id = (private.classbank_remote_pair(p_id, p_key)).id
    and r.pointer is not null
    and r.state->>'ended' = 'false'
    and r.state->>'pointerClickEnabled' = 'true'
    and r.state->>'stepIndex' = p_step::text;
  return found;
end;
$$;

revoke all on function public.remote_qr_click_pointer(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.remote_qr_click_pointer(uuid, uuid, integer, integer) to anon;

notify pgrst, 'reload schema';
commit;
