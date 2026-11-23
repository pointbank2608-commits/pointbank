-- Requires 141. Deleting an assignment also revokes its linked game and per-student links.
begin;
create function public.wm_plan_delete(p_plan uuid) returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  academy uuid := public.wm_staff_academy();
  linked_game uuid;
begin
  delete from public.wm_plans where id = p_plan and academy_id = academy
    returning game_assignment_id into linked_game;
  if linked_game is not null then
    delete from public.homework_assignments where id = linked_game and academy_id = academy;
  end if;
end $$;
revoke all on function public.wm_plan_delete(uuid) from public, anon, authenticated;
grant execute on function public.wm_plan_delete(uuid) to authenticated;
commit;
