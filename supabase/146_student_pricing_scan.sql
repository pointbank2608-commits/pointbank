-- New subscriptions consent to a maximum monthly amount. Old subscriptions keep their flat rate.
begin;
alter table public.academy_billing_keys add column student_price_limit integer
  check (student_price_limit between 0 and 400000);
create table public.student_pricing_consents (
  academy_id uuid not null references public.academies(id) on delete cascade,
  approved_at timestamptz not null default now(), approved_by uuid,
  effective_on date not null, student_limit integer not null, maximum_krw integer not null
);
alter table public.student_pricing_consents enable row level security;
revoke all on public.student_pricing_consents from public, anon, authenticated;
grant insert on public.student_pricing_consents to service_role;
create table public.subscription_period_prices (
  academy_id uuid references public.academies(id) on delete cascade,
  due_date date not null, student_count integer not null, amount_krw integer not null,
  primary key (academy_id, due_date)
);
alter table public.subscription_period_prices enable row level security;
revoke all on public.subscription_period_prices from public, anon, authenticated;

grant select,insert on public.subscription_period_prices to service_role;

create function public.activate_student_subscription(
  p_academy_id uuid, p_billing_key text, p_first_charge_on date, p_next_charge_on date,
  p_student_count integer, p_amount_krw integer, p_paid_payment_id text
) returns boolean language plpgsql set search_path='' as $$
declare existing boolean; activated boolean;
begin
  if p_student_count not between 0 and 400000 or p_amount_krw <> 9900 + p_student_count * 4900 then
    raise exception 'invalid_subscription_quote';
  end if;
  select plan='paid' and next_billing_at is not null into existing from public.academies where id=p_academy_id for update;
  activated := public.activate_monthly_subscription(p_academy_id,p_billing_key,p_first_charge_on,
    p_next_charge_on,p_student_count,p_amount_krw,p_paid_payment_id);
  if activated and not existing then
    insert into public.student_pricing_consents(academy_id,effective_on,student_limit,maximum_krw)
      values(p_academy_id,p_first_charge_on,p_student_count,p_amount_krw);
    update public.academy_billing_keys set student_price_limit=p_student_count where academy_id=p_academy_id;
  end if;
  return activated;
end $$;
revoke all on function public.activate_student_subscription(uuid,text,date,date,integer,integer,text) from public,anon,authenticated;
grant execute on function public.activate_student_subscription(uuid,text,date,date,integer,integer,text) to service_role;

-- A quote remains unchanged across cron retries for the same renewal.
create function public.subscription_period_quote(p_academy uuid,p_due date)
returns table(student_count integer, amount_krw integer) language plpgsql set search_path='' as $$
declare n integer; lim integer;
begin
  perform 1 from public.academies where id=p_academy and next_billing_at=p_due and plan_status <> 'pending_cancel' for update;
  if not found then raise exception 'subscription_period_changed'; end if;
  select count(*) into n from public.students where academy_id=p_academy and archived_at is null;
  select student_price_limit into strict lim from public.academy_billing_keys where academy_id=p_academy;
  insert into public.subscription_period_prices values(p_academy,p_due,n,
    9900 + case when lim is null then 0 else least(n,lim)*4900 end) on conflict do nothing;
  return query select q.student_count,q.amount_krw from public.subscription_period_prices q
    where q.academy_id=p_academy and q.due_date=p_due;
end $$;
revoke all on function public.subscription_period_quote(uuid,date) from public,anon,authenticated;
grant execute on function public.subscription_period_quote(uuid,date) to service_role;

create function public.confirm_student_price_limit(p_limit integer,p_due date,p_max_amount integer)
returns void language plpgsql security definer set search_path='' as $$
declare aid uuid; n integer;
begin
  select academy_id into aid from public.profiles where id=auth.uid() and role='owner';
  perform 1 from public.academies where id=aid and plan='paid' and plan_status='active'
    and next_billing_at=p_due and p_due>(now() at time zone 'Asia/Seoul')::date for update;
  if not found then raise exception '결제 예정일과 구독 상태를 다시 확인해 주세요.'; end if;
  select count(*) into n from public.students where academy_id=aid and archived_at is null;
  if p_limit is null or p_limit not between n and 400000 or p_max_amount is distinct from 9900+p_limit*4900 then
    raise exception '현재 학생 수와 월 금액을 다시 확인해 주세요.';
  end if;
  update public.academy_billing_keys set student_price_limit=p_limit where academy_id=aid;
  if not found then raise exception 'missing_subscription'; end if;
  insert into public.student_pricing_consents(academy_id,approved_by,effective_on,student_limit,maximum_krw)
    values(aid,auth.uid(),p_due,p_limit,p_max_amount);
end $$;
revoke all on function public.confirm_student_price_limit(integer,date,integer) from public,anon;
grant execute on function public.confirm_student_price_limit(integer,date,integer) to authenticated;

-- Owner can approve an additional student while registering them. A failed or
-- replayed registration must not independently raise the approved price.
create function public.student_add_with_price(
  p_request uuid,p_class uuid,p_name text,p_login_phone text,p_login_consent boolean,
  p_parent_name text,p_parent_phone text,p_parent_consent boolean,p_due date,p_total integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid:=public.my_academy_id(); n integer; lim integer;
begin
  if not coalesce(public.is_owner(),false) then raise exception 'not_owner'; end if;
  perform 1 from public.academies where id=aid for update;
  if not exists(select 1 from public.student_info_requests where id=p_request and academy_id=aid) then
    select count(*)+1 into n from public.students where academy_id=aid and archived_at is null;
    select student_price_limit into lim from public.academy_billing_keys where academy_id=aid;
    if lim is null or p_total is distinct from 9900+4900*n then raise exception 'student_price_changed'; end if;
    perform public.confirm_student_price_limit(greatest(lim,n),p_due,9900+4900*greatest(lim,n));
  end if;
  return public.student_save_info(p_request,null,p_class,p_name,p_login_phone,p_login_consent,
    p_parent_name,p_parent_phone,p_parent_consent);
end $$;
revoke all on function public.student_add_with_price(uuid,uuid,text,text,boolean,text,text,boolean,date,integer) from public,anon;
grant execute on function public.student_add_with_price(uuid,uuid,text,text,boolean,text,text,boolean,date,integer) to authenticated;

create function public.guard_student_price_limit() returns trigger language plpgsql security definer set search_path='' as $$
declare lim integer;
begin
  if new.archived_at is not null then return new; end if;
  if tg_op='UPDATE' then
    if old.academy_id=new.academy_id and old.archived_at is null then return new; end if;
  end if;
  perform 1 from public.academies where id=new.academy_id and plan='paid' and next_billing_at is not null for update;
  if found then
    select student_price_limit into lim from public.academy_billing_keys where academy_id=new.academy_id;
    if lim is not null and (select count(*) from public.students where academy_id=new.academy_id and archived_at is null)>=lim then
      raise exception 'student_price_limit';
    end if;
  end if;
  return new;
end $$;
create trigger guard_student_price_limit before insert or update of academy_id, archived_at on public.students
for each row execute function public.guard_student_price_limit();

-- Only platform admins may grant scans. No row means off, including for a newly created academy.
create table public.academy_scan_access (
  academy_id uuid primary key references public.academies(id) on delete cascade,
  enabled boolean not null default false
);
alter table public.academy_scan_access enable row level security;
revoke all on public.academy_scan_access from public, anon, authenticated;
grant select,insert,update on public.academy_scan_access to authenticated;
create policy scan_read on public.academy_scan_access for select to authenticated
  using(public.is_platform_admin() or (academy_id=public.my_academy_id() and public.is_staff()));
create policy scan_admin_insert on public.academy_scan_access for insert to authenticated with check(public.is_platform_admin());
create policy scan_admin_update on public.academy_scan_access for update to authenticated
  using(public.is_platform_admin()) with check(public.is_platform_admin());
create function public.reserve_enabled_scan(p_academy_id uuid) returns boolean language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.academy_scan_access where academy_id=p_academy_id and enabled) then
    raise sqlstate '42501' using message='scan_disabled';
  end if;
  return public.reserve_textbook_extraction(p_academy_id);
end $$;
revoke all on function public.reserve_enabled_scan(uuid) from public,anon;
grant execute on function public.reserve_enabled_scan(uuid) to authenticated;
commit;
