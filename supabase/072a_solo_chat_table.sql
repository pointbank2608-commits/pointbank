-- 072: 개별수업 중 선생님 ↔ 학생 1:1 채팅(1차).
--  - 반(classes)마다 채팅 방식을 고른다: off(끔, 기본) / quick(빠른 문장만 — 유치원) / free(자유 입력 + 빠른 문장).
--  - 학생끼리는 대화할 수 없다. 메시지는 학생 한 명 ↔ 그 수업(assignment) 단위.
--  - 학생은 기기 열쇠(045)로, 선생님은 로그인(자기 학원)으로만 읽고 쓴다. 표는 직접 못 열고 함수로만 접근한다.
--  - 30일이 지난 메시지는 함수가 불릴 때마다 지운다(별도 예약 작업 없음).
--  - 길이 200자, 학생은 1분에 6개까지(도배 방지).

alter table public.classes add column if not exists chat_mode text not null default 'off';
alter table public.classes drop constraint if exists classes_chat_mode_check;
alter table public.classes add constraint classes_chat_mode_check check (chat_mode in ('off', 'quick', 'free'));

create table if not exists public.solo_chat_messages (
  id bigserial primary key,
  academy_id uuid not null references public.academies (id) on delete cascade,
  assignment_id uuid not null references public.solo_assignments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  sender text not null check (sender in ('student', 'teacher')),
  body text not null check (char_length(body) between 1 and 200),
  quick boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists solo_chat_assignment_idx on public.solo_chat_messages (assignment_id, id);
create index if not exists solo_chat_academy_idx on public.solo_chat_messages (academy_id, created_at desc);
alter table public.solo_chat_messages enable row level security;
revoke all on public.solo_chat_messages from anon, authenticated;

-- 학생이 보낼 수 있는 빠른 문장(앱의 목록과 같아야 한다)
create or replace function public.solo_chat_quick_ok(p text) returns boolean
language sql immutable as $fn$
  select p = any (array['모르겠어요', '도와주세요', '다 했어요', '화장실 가도 돼요?', '다시 설명해 주세요', '잘 안 들려요'])
$fn$;

