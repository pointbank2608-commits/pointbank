-- 073: 채팅 2차 — 숙제 화면에서도 선생님과 대화.
-- 같은 메시지 표(solo_chat_messages)를 쓰고, 숙제 대화는 숙제 진행 기록(homework_attempts)에 붙인다.
-- (개별수업 대화는 assignment_id, 숙제 대화는 hw_attempt_id — 둘 중 하나만 채운다.)

alter table public.solo_chat_messages alter column assignment_id drop not null;
alter table public.solo_chat_messages add column if not exists hw_attempt_id uuid references public.homework_attempts (id) on delete cascade;
alter table public.solo_chat_messages drop constraint if exists solo_chat_one_thread;
alter table public.solo_chat_messages add constraint solo_chat_one_thread check ((assignment_id is not null) <> (hw_attempt_id is not null));
create index if not exists solo_chat_hw_idx on public.solo_chat_messages (hw_attempt_id, id);
