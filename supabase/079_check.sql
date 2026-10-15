-- 079 확인(읽기 전용)
select
  exists (select 1 from information_schema.columns
           where table_name = 'support_tickets' and column_name = 'attached_lesson_id') as attached_col,
  to_regclass('public.faq_entries') is not null as faq_table,
  exists (select 1 from pg_proc where proname = 'admin_inbox') as inbox_fn,
  exists (select 1 from pg_proc where proname = 'admin_ticket_lesson') as lesson_fn,
  exists (select 1 from pg_proc where proname = 'admin_bulk_reply') as bulk_fn;
