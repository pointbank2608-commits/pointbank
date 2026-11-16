-- Apply before deploying the phone text input UI.
begin;

alter table public.remote_sessions
  add column text_seq bigint not null default 0,
  add column text_input jsonb;

-- Acknowledgement removes the draft. A change of field or slide also drops pending text.
create function private.classbank_clear_remote_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.state->>'ended' is distinct from 'false'
    or new.state->>'stepIndex' is distinct from old.state->>'stepIndex'
    or new.state->'textTarget'->>'id' is distinct from old.state->'textTarget'->>'id'
    or (old.text_input->>'expiresAt')::bigint <= extract(epoch from now()) * 1000 then
    new.text_input := null;
  end if;
  return new;
end;
$$;
revoke all on function private.classbank_clear_remote_text() from public, anon, authenticated;
create trigger classbank_clear_remote_text before update of state on public.remote_sessions
for each row execute function private.classbank_clear_remote_text();

create function public.remote_qr_write_text(p_id uuid, p_key uuid, p_target uuid, p_text text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_target is null or p_text is null or char_length(p_text) > 2000 then
    return false;
  end if;

  update public.remote_sessions r set
    text_seq = r.text_seq + 1,
    text_input = jsonb_build_object(
      'target', p_target, 'draft', p_text,
      'expiresAt', floor(extract(epoch from now() + interval '20 seconds') * 1000)::bigint
    )
  where r.id = (private.classbank_remote_pair(p_id, p_key)).id
    and r.state->>'ended' = 'false'
    and r.state->'textTarget'->>'id' = p_target::text
    and char_length(p_text) <= (r.state->'textTarget'->>'limit')::integer
    and (r.state->'textTarget'->>'multiline' = 'true'
      or (position(chr(10) in p_text) = 0 and position(chr(13) in p_text) = 0));
  return found;
end;
$$;

revoke all on function public.remote_qr_write_text(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.remote_qr_write_text(uuid, uuid, uuid, text) to anon;

notify pgrst, 'reload schema';
commit;
