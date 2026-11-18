-- Apply after 086b (admin audit log) and 122 (single-session enforcement),
-- before deploying the admin controls.
begin;

create table private.classbank_multi_session_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table private.classbank_multi_session_accounts enable row level security;
revoke all on private.classbank_multi_session_accounts from public, anon, authenticated;

create or replace function private.classbank_session_matches(p_user uuid, p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select from auth.sessions s
    where s.id = p_session and s.user_id = p_user
      and (
        exists (select from private.classbank_account_sessions active
                where active.user_id = s.user_id and active.session_id = s.id)
        or exists (select from private.classbank_multi_session_accounts allowed
                   where allowed.user_id = s.user_id)
      )
  );
$$;

create function public.admin_search_login_accounts(p_query text)
returns table (user_id uuid, email text, display_name text, allow_multiple boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  search_term text := lower(btrim(coalesce(p_query, '')));
begin
  if public.is_platform_admin() is not true then
    raise sqlstate '42501' using message = 'admin_required';
  end if;
  if char_length(search_term) not between 2 and 320 then return; end if;

  return query
    select u.id, u.email::text, p.display_name, allowed.user_id is not null
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join private.classbank_multi_session_accounts allowed on allowed.user_id = u.id
    where strpos(lower(u.email), search_term) > 0
       or strpos(lower(p.display_name), search_term) > 0
       or u.id::text = search_term
    order by (lower(u.email) = search_term) desc nulls last, lower(u.email), u.id
    limit 25;
end;
$$;
revoke all on function public.admin_search_login_accounts(text) from public, anon, authenticated;
grant execute on function public.admin_search_login_accounts(text) to authenticated;

create function public.admin_set_login_account_policy(p_user_id uuid, p_allow_multiple boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_academy uuid;
  was_allowed boolean;
begin
  if public.is_platform_admin() is not true then
    raise sqlstate '42501' using message = 'admin_required';
  end if;
  if p_allow_multiple is null then
    raise sqlstate '22023' using message = 'session_policy_required';
  end if;

  -- Serialize changes for this account, including its audit record.
  perform 1 from auth.users u where u.id = p_user_id for no key update;
  if not found then
    raise sqlstate '22023' using message = 'login_account_not_found';
  end if;

  select exists (select from private.classbank_multi_session_accounts where user_id = p_user_id)
    into was_allowed;
  if was_allowed = p_allow_multiple then return; end if;

  if p_allow_multiple then
    insert into private.classbank_multi_session_accounts (user_id) values (p_user_id);
  else
    delete from private.classbank_multi_session_accounts where user_id = p_user_id;
  end if;

  select academy_id into target_academy from public.profiles where id = p_user_id;
  insert into public.admin_actions (academy_id, action, detail, before, after)
  values (target_academy, 'set_login_account_policy', jsonb_build_object('user_id', p_user_id),
          jsonb_build_object('allow_multiple', was_allowed),
          jsonb_build_object('allow_multiple', p_allow_multiple));
end;
$$;
revoke all on function public.admin_set_login_account_policy(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_login_account_policy(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
