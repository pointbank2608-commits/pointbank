-- Apply after 131_admin_account_session_policy.sql and before deploying the academy switch.
begin;

create table private.classbank_academy_login_policies (
  academy_id uuid primary key references public.academies(id) on delete cascade,
  allow_multiple boolean not null
);
alter table private.classbank_academy_login_policies enable row level security;
revoke all on private.classbank_academy_login_policies from public, anon, authenticated;

-- Membership and role determine whose login policy applies. Self-service profile
-- edits can still update display data. Trusted membership RPCs run as their owner.
create function private.classbank_protect_login_membership()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') and
    (new.academy_id is distinct from old.academy_id or new.role is distinct from old.role) then
    raise sqlstate '42501' using message = 'profile_membership_read_only';
  end if;
  return new;
end;
$$;
revoke all on function private.classbank_protect_login_membership() from public, anon, authenticated;
create trigger classbank_protect_login_membership before update of academy_id, role on public.profiles
for each row execute function private.classbank_protect_login_membership();

create or replace function private.classbank_session_matches(p_user uuid, p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select from auth.sessions s
    where s.id = p_session and s.user_id = p_user
      and (
        exists (select from private.classbank_account_sessions active
                where active.user_id = s.user_id and active.session_id = s.id)
        or coalesce(
          (select policy.allow_multiple
           from public.profiles p
           join private.classbank_academy_login_policies policy on policy.academy_id = p.academy_id
           where p.id = s.user_id and p.role in ('owner', 'teacher')),
          exists (select from private.classbank_multi_session_accounts allowed where allowed.user_id = s.user_id)
        )
      )
  );
$$;

create function private.classbank_academy_login_policy(p_academy_id uuid)
returns text language sql stable set search_path = '' as $$
  select coalesce(
    (select case when allow_multiple then 'allowed' else 'blocked' end
     from private.classbank_academy_login_policies where academy_id = p_academy_id),
    (select case
       when bool_and(allowed.user_id is not null) then 'allowed'
       when bool_or(allowed.user_id is not null) then 'mixed'
       else 'blocked'
     end
     from public.profiles p
     left join private.classbank_multi_session_accounts allowed on allowed.user_id = p.id
     where p.academy_id = p_academy_id and p.role in ('owner', 'teacher'))
  );
$$;
revoke all on function private.classbank_academy_login_policy(uuid) from public, anon, authenticated;

create function public.admin_academy_login_policy(p_academy_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if public.is_platform_admin() is not true then
    raise sqlstate '42501' using message = 'admin_required';
  end if;
  if not exists (select from public.academies where id = p_academy_id) then
    raise sqlstate '22023' using message = 'academy_not_found';
  end if;
  return private.classbank_academy_login_policy(p_academy_id);
end;
$$;
revoke all on function public.admin_academy_login_policy(uuid) from public, anon, authenticated;
grant execute on function public.admin_academy_login_policy(uuid) to authenticated;

create function public.admin_set_academy_login_policy(p_academy_id uuid, p_allow_multiple boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  previous_policy text;
  next_policy text := case when p_allow_multiple then 'allowed' else 'blocked' end;
begin
  if public.is_platform_admin() is not true then
    raise sqlstate '42501' using message = 'admin_required';
  end if;
  if p_allow_multiple is null then
    raise sqlstate '22023' using message = 'session_policy_required';
  end if;
  perform 1 from public.academies where id = p_academy_id for no key update;
  if not found then
    raise sqlstate '22023' using message = 'academy_not_found';
  end if;

  previous_policy := private.classbank_academy_login_policy(p_academy_id);
  insert into private.classbank_academy_login_policies as policy (academy_id, allow_multiple)
  values (p_academy_id, p_allow_multiple)
  on conflict (academy_id) do update set allow_multiple = excluded.allow_multiple
    where policy.allow_multiple is distinct from excluded.allow_multiple;

  if found then
    insert into public.admin_actions (academy_id, action, before, after)
    values (p_academy_id, 'set_academy_login_policy', jsonb_build_object('policy', previous_policy),
            jsonb_build_object('policy', next_policy));
  end if;
  return next_policy;
end;
$$;
revoke all on function public.admin_set_academy_login_policy(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_academy_login_policy(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
