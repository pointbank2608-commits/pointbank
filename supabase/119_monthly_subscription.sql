-- A new academy has 14 trial days, including the Korean calendar date of sign-up.
alter table public.academies alter column trial_ends_at
  set default ((now() at time zone 'Asia/Seoul')::date + 13);

create or replace function public.activate_monthly_subscription(
  p_academy_id uuid, p_billing_key text, p_first_charge_on date, p_next_charge_on date,
  p_student_count integer, p_amount_krw integer, p_paid_payment_id text
) returns boolean
language plpgsql set search_path = ''
as $$
begin
  perform 1 from public.academies where id=p_academy_id for update;
  if not found then return false; end if;

  if exists (select 1 from public.academies where id=p_academy_id and plan='paid' and next_billing_at is not null) then
    return p_paid_payment_id is not null and exists (
      select 1 from public.billing_history
      where academy_id=p_academy_id and portone_payment_id=p_paid_payment_id and status='success'
    );
  end if;

  insert into public.academy_billing_keys (academy_id,billing_key,customer_uid)
  values (p_academy_id,p_billing_key,p_academy_id::text)
  on conflict (academy_id) do update set billing_key=excluded.billing_key,
    customer_uid=excluded.customer_uid,updated_at=now();

  if p_paid_payment_id is not null then
    insert into public.billing_history (academy_id,period_start,period_end,student_count,amount_krw,status,portone_payment_id)
    values (p_academy_id,p_first_charge_on,p_next_charge_on,p_student_count,p_amount_krw,'success',p_paid_payment_id);
  end if;

  update public.academies set plan='paid',plan_source='subscription',plan_status='active',plan_started_at=now(),
    plan_expires_at=null,billing_cycle_day=extract(day from p_first_charge_on)::int,
    next_billing_at=p_next_charge_on,billing_failure_count=0
  where id=p_academy_id;
  return true;
end;
$$;

revoke all on function public.activate_monthly_subscription(uuid,text,date,date,integer,integer,text) from public, anon, authenticated;
grant execute on function public.activate_monthly_subscription(uuid,text,date,date,integer,integer,text) to service_role;
