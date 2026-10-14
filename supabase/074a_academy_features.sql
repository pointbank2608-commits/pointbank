-- 074: 학원별 기능 열기·닫기(단체수업 / 개별수업 / 숙제). 관리자 화면에서 학원마다 켜고 끈다.
--  - academies.features 에 { "group": bool, "solo": bool, "homework": bool } 중 정한 것만 적는다.
--  - 적지 않은 칸은 기본값: 단체수업 열림, 개별수업·숙제 닫힘(새 학원은 닫힌 채로 시작).
--  - 이미 있는 학원은 지금 쓰는 기능이 끊기지 않게 세 칸 모두 열림으로 적어 둔다(처음 한 번만).

alter table public.academies add column if not exists features jsonb not null default '{}'::jsonb;

update public.academies
   set features = '{"group": true, "solo": true, "homework": true}'::jsonb
 where features = '{}'::jsonb;

create or replace function public.academy_feature(p_academy uuid, p_key text)
returns boolean
language sql stable security definer set search_path = public
as $fn$
  select coalesce(
    (select (a.features ->> p_key)::boolean from public.academies a where a.id = p_academy),
    p_key = 'group'
  )
$fn$;

revoke all on function public.academy_feature(uuid, text) from public, anon, authenticated;
