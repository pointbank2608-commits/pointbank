-- 086l: 안내 메시지 대상 계산·미리보기(실제 발송은 하지 않는다 — 발송은 Edge Function lifecycle-send).
-- 대상에서 빼는 학원: 테스트 표시, 삭제 요청 중, 원장 이메일 없음. 같은 안내는 (kind, dedupe_key)가 같으면 한 번만 계획된다.
-- dedupe_key: welcome/stalled = 학원 / trial_ending = 학원+종료일 / billing_failed = 학원+실패 횟수 / cancel = 학원+다음 결제일 / plan_ending = 학원+만료일

create or replace function public.admin_lifecycle_targets(p_kind text)
returns table (academy_id uuid, academy_name text, owner_email text, dedupe_key text, already_planned boolean)
language sql stable security definer set search_path = public
as $$
  with prm as (select (now() at time zone 'Asia/Seoul')::date as today),
  cand as (
    select r.id, r.name, r.o_email,
      case p_kind
        when 'welcome_first_use' then case when r.created_at >= now() - interval '3 days' then r.id::text end
        when 'stalled_help' then case when r.created_at between now() - interval '14 days' and now() - interval '3 days' and r.classes = 0 then r.id::text end
        when 'trial_ending' then case when r.entitlement = 'trial' and r.trial_ends_at <= prm.today + 3 then r.id::text || ':' || r.trial_ends_at end
        when 'billing_failed' then case when r.billing_failure_count > 0 then r.id::text || ':' || r.billing_failure_count end
        when 'cancel_scheduled' then case when r.plan_status = 'pending_cancel' and r.entitlement = 'full' then r.id::text || ':' || coalesce(r.next_billing_at::text, 'x') end
        when 'plan_ending' then case when r.entitlement = 'full' and r.source <> 'subscription' and r.plan_expires_at between prm.today and prm.today + 3 then r.id::text || ':' || r.plan_expires_at end
      end as k
      from public.admin_academy_rollup r cross join prm
     where not r.is_test and r.o_email is not null
       and not exists (select 1 from public.academy_deletion_requests d where d.academy_id = r.id)
  )
  select c.id, c.name, c.o_email, c.k,
         exists (select 1 from public.lifecycle_messages m where m.kind = p_kind and m.dedupe_key = c.k)
    from cand c where c.k is not null and (public.is_platform_admin() or auth.role() = 'service_role');
$$;

-- 미리보기: 몇 곳에 새로 가고, 이미 계획돼 건너뛰는 건 몇 건인지 + 앞 10곳
create or replace function public.admin_lifecycle_preview(p_kind text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when not public.is_platform_admin() then null else jsonb_build_object(
    'kind', p_kind,
    'new', (select count(*) from public.admin_lifecycle_targets(p_kind) where not already_planned),
    'skipped_duplicate', (select count(*) from public.admin_lifecycle_targets(p_kind) where already_planned),
    'sample', (select coalesce(jsonb_agg(jsonb_build_object('academy', academy_name, 'email', owner_email)), '[]'::jsonb)
                 from (select academy_name, owner_email from public.admin_lifecycle_targets(p_kind) where not already_planned limit 10) s)
  ) end;
$$;

revoke all on function public.admin_lifecycle_targets(text) from public, anon;
revoke all on function public.admin_lifecycle_preview(text) from public, anon;
grant execute on function public.admin_lifecycle_targets(text) to authenticated, service_role;
grant execute on function public.admin_lifecycle_preview(text) to authenticated;
