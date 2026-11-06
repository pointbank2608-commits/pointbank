-- A PostgREST call to a STABLE RPC runs in a read-only transaction.
-- The portal session helper updates last_seen_at, so validate the token here with a read.
begin;

create or replace function public.wm_student_links(p_token uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'title', p.title,
      'access', t.access_token,
      'phase', case when public.wm_today() - p.start_date < p.study_days then 'study' else 'review' end
    ) order by p.created_at desc),
    '[]'::jsonb
  )
  from public.student_sessions s
  join public.students st on st.id = s.student_id and st.archived_at is null
  join public.wm_targets t on t.student_id = st.id
  join public.wm_plans p on p.id = t.plan_id and p.academy_id = st.academy_id
  where s.token = p_token and s.expires_at > now()
    and p.closed_at is null
    and (p.rule_version = 'wm-v2' or public.wm_today() - p.start_date < p.study_days + p.review_days)
    and public.academy_feature(p.academy_id, 'homework')
$$;

revoke all on function public.wm_student_links(uuid) from public;
grant execute on function public.wm_student_links(uuid) to anon, authenticated;

commit;
