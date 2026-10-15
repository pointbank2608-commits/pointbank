-- 078d: 주간 운영 리포트 재료(Edge Function weekly-report 가 service role 로만 부른다)

create or replace function public.admin_weekly_report()
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'generated_at', now(),
    'academies', (select count(*) from public.academies),
    'signups_7d', (select count(*) from public.academies where created_at >= now() - interval '7 days'),
    'signups_prev_7d', (select count(*) from public.academies
                          where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days'),
    'active_7d', (select count(distinct p.academy_id) from public.profiles p
                    join auth.users u on u.id = p.id
                   where p.academy_id is not null and u.last_sign_in_at >= now() - interval '7 days'),
    'paid', (select count(*) from public.academies where plan = 'paid'),
    'stuck_no_wordlist', (select count(*) from public.academies a
                           where a.created_at between now() - interval '14 days' and now() - interval '2 days'
                             and not exists (select 1 from public.word_lists w where w.academy_id = a.id)),
    'dormant_paid', (select count(*) from public.academies a
                      where a.plan = 'paid' and not exists (
                        select 1 from public.profiles p join auth.users u on u.id = p.id
                         where p.academy_id = a.id and u.last_sign_in_at >= now() - interval '14 days')),
    'tickets_new_7d', (select count(*) from public.support_tickets where created_at >= now() - interval '7 days'),
    'tickets_open', (select count(*) from public.support_tickets where status = 'open'),
    'oldest_open_hours', (select coalesce(round(extract(epoch from now() - min(updated_at)) / 3600), 0)
                            from public.support_tickets where status = 'open'),
    'tickets_by_category', (select coalesce(json_object_agg(category, n), '{}'::json) from (
                              select category, count(*) n from public.support_tickets
                               where created_at >= now() - interval '7 days' group by category) c),
    'top_errors', (select coalesce(json_agg(x), '[]'::json) from (
                     select left(message, 120) as message, count(*) as events, count(distinct user_id) as users
                       from public.client_errors where created_at >= now() - interval '7 days'
                      group by fingerprint, left(message, 120)
                      order by count(distinct user_id) desc, count(*) desc limit 5) x)
  );
$$;

revoke execute on function public.admin_weekly_report() from public, anon, authenticated;
grant execute on function public.admin_weekly_report() to service_role;
