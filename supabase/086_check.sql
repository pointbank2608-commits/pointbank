-- 086a~u 확인(읽기 전용) — SQL 편집기에서 한 번에 실행해도 된다. 데이터를 바꾸지 않는다.
-- 기대: 모든 줄의 ok 가 true. false 인 줄이 있으면 그 줄의 이름에 해당하는 086 파일을 아직 실행하지 않은 것이다.

select 'a: academies.plan_source/is_test 칸' as item,
       (select count(*) = 2 from information_schema.columns where table_schema = 'public' and table_name = 'academies' and column_name in ('plan_source', 'is_test')) as ok
union all select 'b: admin_settings + 조치 기록 칸(reason/result/batch_id/before/after)',
       (select count(*) = 5 from information_schema.columns where table_schema = 'public' and table_name = 'admin_actions' and column_name in ('reason', 'result', 'batch_id', 'before', 'after'))
       and to_regclass('public.admin_settings') is not null
union all select 'c: admin_academy_facts 뷰 + admin_change_plan',
       to_regclass('public.admin_academy_facts') is not null and exists (select 1 from pg_proc where proname = 'admin_change_plan')
union all select 'd: admin_overview',
       exists (select 1 from pg_proc where proname = 'admin_overview') and exists (select 1 from pg_proc where proname = 'admin_set_academy_test')
union all select 'e/f: 문의 admin_state·priority 칸 + admin_ticket_set',
       (select count(*) = 2 from information_schema.columns where table_schema = 'public' and table_name = 'support_tickets' and column_name in ('admin_state', 'priority'))
       and exists (select 1 from pg_proc where proname = 'admin_ticket_set')
union all select 'g: admin_academy_rollup 뷰', to_regclass('public.admin_academy_rollup') is not null
union all select 'h: admin_academy_search(새 시그니처) + admin_academy_ids',
       exists (select 1 from pg_proc where proname = 'admin_academy_ids') and exists (select 1 from pg_proc where proname = 'admin_academy_search')
union all select 'i: admin_ticket_search', exists (select 1 from pg_proc where proname = 'admin_ticket_search')
union all select 'j/k: 자동 작업 표(10개 등록)',
       to_regclass('public.automation_jobs') is not null and (select count(*) >= 10 from public.automation_jobs)
union all select 'k: 발송 작업은 기본이 꺼짐·모의 실행(켜진 실제 발송 0개)',
       (select count(*) = 0 from public.automation_jobs where managed = 'internal' and enabled and mode = 'live')
union all select 'l/m: 대상 계산·실행 함수', exists (select 1 from pg_proc where proname = 'admin_lifecycle_run') and exists (select 1 from pg_proc where proname = 'lifecycle_claim_batch')
union all select 'n: admin_jobs_status', exists (select 1 from pg_proc where proname = 'admin_jobs_status')
union all select 'o/p: admin_issues + 동기화', to_regclass('public.admin_issues') is not null and exists (select 1 from pg_proc where proname = 'admin_issues_sync')
union all select 'q: admin_error_groups', exists (select 1 from pg_proc where proname = 'admin_error_groups')
union all select 'r/s: 대량 변경 표 + 적용·되돌리기', to_regclass('public.admin_bulk_batches') is not null and exists (select 1 from pg_proc where proname = 'admin_bulk_undo')
union all select 't: 삭제 안전장치 + 저장한 조건', to_regclass('public.admin_saved_filters') is not null and exists (select 1 from pg_proc where proname = 'admin_request_deletion')
union all select 'u: payment_events + 결제 요약', to_regclass('public.payment_events') is not null and exists (select 1 from pg_proc where proname = 'admin_billing_overview');

-- 정보용(참고) — 분류되지 않은 유료 학원 수와 지금 켜진 자동 작업. 숫자만 나오고 학원 이름·이메일은 나오지 않는다.
select (select count(*) from public.academies where plan = 'paid' and plan_source is null and card_last4 is null) as paid_without_source_or_card,
       (select count(*) from public.automation_jobs where enabled) as enabled_jobs;
