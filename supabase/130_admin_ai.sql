begin;

create table if not exists public.admin_ai_jobs (
  kind text not null check (kind in ('error', 'ticket')),
  source_id text not null,
  revision text not null,
  ticket_id uuid references public.support_tickets(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending', 'running', 'ready', 'failed', 'skipped')),
  attempts int not null default 0,
  available_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  result jsonb,
  primary key (kind, source_id),
  check ((kind = 'ticket') = (ticket_id is not null))
);

alter table public.admin_ai_jobs enable row level security;
revoke all on public.admin_ai_jobs from public, anon, authenticated;
grant select on public.admin_ai_jobs to authenticated;
grant select, update on public.admin_ai_jobs to service_role;
drop policy if exists admin_ai_jobs_read on public.admin_ai_jobs;
create policy admin_ai_jobs_read on public.admin_ai_jobs for select to authenticated
  using (public.is_platform_admin());

create index if not exists admin_ai_jobs_pending_idx on public.admin_ai_jobs (available_at)
  where state in ('pending', 'running');
create index if not exists admin_ai_jobs_ticket_idx on public.admin_ai_jobs (ticket_id) where ticket_id is not null;

create or replace function public.admin_ai_enqueue_error()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admin_ai_jobs (kind, source_id, revision)
  values ('error', new.fingerprint, new.id::text) on conflict do nothing;
  return new;
end $$;

create or replace function public.admin_ai_enqueue_ticket()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize updates to the same ticket, including an administrator replying during analysis.
  perform 1 from public.support_tickets where id = new.ticket_id for no key update;
  if new.id is distinct from (
    select id from public.support_messages where ticket_id = new.ticket_id
     order by created_at desc, id desc limit 1
  ) then return new; end if;

  insert into public.admin_ai_jobs (kind, source_id, ticket_id, revision, state)
  values ('ticket', new.ticket_id::text, new.ticket_id, new.id::text,
          case when new.sender = 'user' then 'pending' else 'skipped' end)
  on conflict (kind, source_id) do update set revision = excluded.revision,
    state = excluded.state, attempts = 0, available_at = now(), updated_at = now(), result = null;
  return new;
end $$;

revoke all on function public.admin_ai_enqueue_error() from public, anon, authenticated;
revoke all on function public.admin_ai_enqueue_ticket() from public, anon, authenticated;
drop trigger if exists admin_ai_enqueue_error on public.client_errors;
create trigger admin_ai_enqueue_error after insert on public.client_errors
  for each row execute function public.admin_ai_enqueue_error();
drop trigger if exists admin_ai_enqueue_ticket on public.support_messages;
create trigger admin_ai_enqueue_ticket after insert on public.support_messages
  for each row execute function public.admin_ai_enqueue_ticket();

-- Begin with recent errors and open threads. Each subsequent event goes through the triggers.
insert into public.admin_ai_jobs (kind, source_id, revision)
select distinct on (fingerprint) 'error', fingerprint, id::text from public.client_errors
 where created_at > now() - interval '7 days' order by fingerprint, created_at desc, id desc
on conflict do nothing;

insert into public.admin_ai_jobs (kind, source_id, ticket_id, revision)
select 'ticket', t.id::text, t.id, m.id::text from public.support_tickets t
cross join lateral (select id, sender from public.support_messages where ticket_id = t.id
  order by created_at desc, id desc limit 1) m
where t.status = 'open' and t.updated_at > now() - interval '7 days' and m.sender = 'user'
on conflict do nothing;

create or replace function public.admin_ai_claim()
returns setof public.admin_ai_jobs language plpgsql security definer set search_path = '' as $$
begin
  delete from public.admin_ai_jobs j where j.kind = 'error' and j.updated_at < now() - interval '14 days'
    and not exists (select 1 from public.client_errors e where e.fingerprint = j.source_id);
  update public.admin_ai_jobs set state = 'failed', updated_at = now()
    where state = 'running' and available_at <= now() and attempts >= 3;

  return query with next_jobs as (
    select j.kind, j.source_id from public.admin_ai_jobs j
     where j.state in ('pending', 'running') and j.available_at <= now() and j.attempts < 3
     order by j.available_at, j.kind, j.source_id limit 4 for update skip locked
  )
  update public.admin_ai_jobs j set state = 'running', attempts = j.attempts + 1,
    available_at = now() + interval '10 minutes', updated_at = now()
  from next_jobs n where j.kind = n.kind and j.source_id = n.source_id returning j.*;
end $$;

revoke all on function public.admin_ai_claim() from public, anon, authenticated;
grant execute on function public.admin_ai_claim() to service_role;

create or replace function public.admin_ai_error_context(p_fingerprint text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with counts as (
    select count(*) hits, count(distinct user_id) users, count(distinct academy_id) academies,
           min(created_at) first_seen, max(created_at) last_seen
      from public.client_errors where fingerprint = p_fingerprint
  )
  select jsonb_build_object('message', e.message, 'page', e.page, 'stack', e.stack,
    'events', c.hits, 'users', c.users, 'academies', c.academies, 'first_seen', c.first_seen, 'last_seen', c.last_seen)
  from counts c cross join lateral (
    select message, page, stack from public.client_errors where fingerprint = p_fingerprint
    order by created_at desc, id desc limit 1
  ) e;
$$;

revoke all on function public.admin_ai_error_context(text) from public, anon, authenticated;
grant execute on function public.admin_ai_error_context(text) to service_role;

commit;
