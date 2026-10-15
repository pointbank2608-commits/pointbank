-- 081b: 삭제 요청 취소 + 내 학원의 삭제 예정 시각 확인(원장·선생님 둘 다 볼 수 있다)

create or replace function public.cancel_academy_deletion()
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_academy uuid;
begin
  select academy_id into v_academy from public.profiles where id = auth.uid() and role = 'owner';
  if v_academy is null then
    raise exception '원장님만 취소할 수 있어요.';
  end if;
  delete from public.academy_deletion_requests where academy_id = v_academy;
end $$;

create or replace function public.my_deletion_request()
returns timestamptz
language sql stable security definer set search_path = public
as $$
  select r.requested_at
    from public.academy_deletion_requests r
    join public.profiles p on p.academy_id = r.academy_id
   where p.id = auth.uid()
$$;

revoke execute on function public.cancel_academy_deletion() from public, anon;
revoke execute on function public.my_deletion_request() from public, anon;
grant execute on function public.cancel_academy_deletion() to authenticated;
grant execute on function public.my_deletion_request() to authenticated;
