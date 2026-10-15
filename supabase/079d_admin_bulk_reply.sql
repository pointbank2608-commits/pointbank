-- 079d: 같은 답변을 여러 문의에 한 번에 보낸다(최대 50건, 조치 기록에 남는다)

create or replace function public.admin_bulk_reply(p_ticket_ids uuid[], p_body text)
returns int
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_id uuid;
  v_n int := 0;
begin
  if not public.is_platform_admin() then
    raise exception '관리자만 할 수 있어요.';
  end if;
  if p_body is null or length(trim(p_body)) = 0 then
    raise exception '답변 내용이 비어 있어요.';
  end if;

  foreach v_id in array p_ticket_ids[1:50] loop
    if exists (select 1 from public.support_tickets where id = v_id and status <> 'closed') then
      insert into public.support_messages (ticket_id, sender, author_id, body)
      values (v_id, 'admin', auth.uid(), left(p_body, 4000));
      v_n := v_n + 1;
    end if;
  end loop;

  insert into public.admin_actions (action, detail)
  values ('bulk_reply', json_build_object('count', v_n)::jsonb);

  return v_n;
end $$;

revoke execute on function public.admin_bulk_reply(uuid[], text) from public;
grant execute on function public.admin_bulk_reply(uuid[], text) to authenticated;
