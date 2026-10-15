-- 079b: 승인함 목록 — 답을 기다리는 문의 + 첫 메시지 앞부분(유사 문의 묶기·FAQ 초안용)

create or replace function public.admin_inbox()
returns table (
  id uuid,
  academy_id uuid,
  academy_name text,
  user_name text,
  category text,
  subject text,
  first_body text,
  has_lesson boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select t.id, t.academy_id, a.name, p.display_name, t.category, t.subject,
         (select left(m.body, 800) from public.support_messages m
           where m.ticket_id = t.id and m.sender = 'user' order by m.created_at limit 1),
         t.attached_lesson_id is not null,
         t.created_at, t.updated_at
    from public.support_tickets t
    left join public.academies a on a.id = t.academy_id
    left join public.profiles p on p.id = t.user_id
   where public.is_platform_admin() and t.status = 'open'
   order by t.created_at
   limit 200;
$$;

revoke execute on function public.admin_inbox() from public;
grant execute on function public.admin_inbox() to authenticated;
