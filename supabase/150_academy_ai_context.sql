-- The platform error assistant may use events only from academies with AI enabled.
-- Materialize the eligible slice once so that the counts and latest event share a scope.
create or replace function public.admin_ai_error_context(p_fingerprint text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with eligible as (
    select e.* from public.client_errors e
      join public.academy_scan_access a on a.academy_id = e.academy_id and a.enabled
      where e.fingerprint = p_fingerprint
  ), counts as (
    select count(*) hits, count(distinct user_id) users, count(distinct academy_id) academies,
           min(created_at) first_seen, max(created_at) last_seen from eligible
  )
  select jsonb_build_object('message', e.message, 'page', e.page, 'stack', e.stack,
    'ai_allowed', true, 'events', c.hits, 'users', c.users, 'academies', c.academies,
    'first_seen', c.first_seen, 'last_seen', c.last_seen)
  from counts c cross join lateral (
    select message, page, stack from eligible order by created_at desc, id desc limit 1
  ) e;
$$;
revoke all on function public.admin_ai_error_context(text) from public, anon, authenticated;
grant execute on function public.admin_ai_error_context(text) to service_role;
