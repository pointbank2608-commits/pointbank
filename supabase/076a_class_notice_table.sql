-- 076: 채팅 3차 — 반 전체 공지(1/4) 칸 추가 + 선생님이 공지를 띄우는 함수

alter table public.classes add column if not exists notice_text text;
alter table public.classes add column if not exists notice_until timestamptz;

create or replace function public.class_notice_set(p_class uuid, p_text text, p_minutes integer default 180)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_academy uuid := public.hw_staff_academy();
  v_text text := btrim(coalesce(p_text, ''));
begin
  if char_length(v_text) > 120 then
    raise exception 'bad_body';
  end if;
  update public.classes
     set notice_text = nullif(v_text, ''),
         notice_until = case when v_text = '' then null else now() + make_interval(mins => greatest(5, least(coalesce(p_minutes, 180), 720))) end
   where id = p_class and academy_id = v_academy;
end $fn$;
