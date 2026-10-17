-- 086g: 학원별 합계 보기(마지막 접속·원장·계정·학생·반·미해결 문의) — 학원 목록과 지표가 같이 쓴다.
-- 한 번에 모든 학원을 훑는 집계(학원마다 따로 묻지 않는다). 관리자만 읽을 수 있다(admin_academy_facts 가 걸러 준다).

create or replace view public.admin_academy_rollup as
with act as (select p.academy_id, max(u.last_sign_in_at) as last_active
               from public.profiles p join auth.users u on u.id = p.id where p.academy_id is not null group by 1),
     own as (select distinct on (p.academy_id) p.academy_id, u.email::text as email, p.display_name
               from public.profiles p join auth.users u on u.id = p.id where p.role = 'owner' order by p.academy_id, p.created_at),
     mem as (select academy_id, (count(*) filter (where role = 'owner'))::int as owners, (count(*) filter (where role = 'teacher'))::int as teachers
               from public.profiles where academy_id is not null group by 1),
     stu as (select academy_id, count(*)::int as n from public.students group by 1),
     cls as (select academy_id, count(*)::int as n from public.classes group by 1),
     tix as (select academy_id, count(*)::int as n from public.support_tickets
              where admin_state not in ('resolved', 'closed') and academy_id is not null group by 1)
select f.*, act.last_active, own.email as o_email, own.display_name as o_name,
       coalesce(mem.owners, 0) as owners, coalesce(mem.teachers, 0) as teachers,
       coalesce(stu.n, 0) as students, coalesce(cls.n, 0) as classes, coalesce(tix.n, 0) as tickets
  from public.admin_academy_facts f
  left join act on act.academy_id = f.id
  left join own on own.academy_id = f.id
  left join mem on mem.academy_id = f.id
  left join stu on stu.academy_id = f.id
  left join cls on cls.academy_id = f.id
  left join tix on tix.academy_id = f.id;

revoke all on public.admin_academy_rollup from public, anon, authenticated;
