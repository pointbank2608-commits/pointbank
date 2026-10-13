-- 070: 학생이 "선생님을 불렀어요"를 직접 닫는 창구.
-- 선생님이 자리에 와서 알려 준 뒤 학생이 화면의 "도와줬어요"를 누르면 도움 요청(help_at)이 꺼지고,
-- 선생님 현황판의 도움 요청 목록에서도 사라진다. (4초마다 서버를 확인하지 않는다 — 요청은 누를 때 한 번.)

create or replace function public.solo_help_done(p_token uuid, p_assignment uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.solo_assignments;
begin
  begin
    v_a := public.solo_assignment_for(p_token, p_assignment);
  exception when others then
    return jsonb_build_object('error', case when sqlerrm like '%expired%' then 'expired' else 'not_found' end);
  end;
  update public.solo_assignments set help_at = null, help_step = null where id = v_a.id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.solo_help_done(uuid, uuid) from public, anon, authenticated;
grant execute on function public.solo_help_done(uuid, uuid) to anon, authenticated;
