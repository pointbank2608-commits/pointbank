// 문의 상태·문제 목록·대량 변경·안내 대기열·결제 알림 SQL 검증(임시 Postgres = PGlite)
import { makeDb, as, check, summary } from './lib.mjs';

import { ALL_FILES } from './files.mjs';

const db = await makeDb(ALL_FILES);
const q = async (sql) => (await db.query(sql)).rows;
const one = async (sql) => (await q(sql))[0];
const ADMIN = '00000000-0000-4000-8000-000000000001';
const U1 = '00000000-0000-4000-8000-000000000011';
const U2 = '00000000-0000-4000-8000-000000000012';
const A1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const A2 = 'aaaaaaaa-0000-4000-8000-000000000002';

await db.exec(`
  insert into auth.users (id, email) values ('${ADMIN}', 'admin@x.com'), ('${U1}', 'one@x.com'), ('${U2}', 'two@x.com');
  insert into public.academies (id, name) values ('${A1}', '가학원'), ('${A2}', '나학원');
  insert into public.profiles (id, academy_id, role, display_name) values
    ('${ADMIN}', null, 'admin', '운영자'), ('${U1}', '${A1}', 'owner', '가원장'), ('${U2}', '${A2}', 'owner', '나원장');
`);

// ================= 문의 상태 =================
console.log('\n[문의 상태]');
await as(db, U1);
await db.exec(`insert into public.support_tickets (id, academy_id, user_id, subject, category) values ('11111111-0000-4000-8000-000000000001', '${A1}', '${U1}', '게임이 안 열려요', 'bug')`);
await db.exec(`insert into public.support_messages (ticket_id, sender, body) values ('11111111-0000-4000-8000-000000000001', 'user', '번개 피하기가 멈춰요')`);
await as(db, ADMIN);
let t = await one(`select admin_state, status, last_user_msg_at is not null as has from public.support_tickets where id = '11111111-0000-4000-8000-000000000001'`);
check('새 문의는 신규 상태', t.admin_state === 'new' && t.status === 'open' && t.has);
await db.exec(`update public.support_tickets set last_user_msg_at = now() - interval '30 hours' where id = '11111111-0000-4000-8000-000000000001'`);
let s = await one(`select overdue, wait_minutes, sla_hours from public.admin_ticket_search('', 'active', null, null, false, null, 'wait', 10, 0)`);
check('보통 긴급도 24시간 목표를 넘기면 기한 초과', s.overdue === true && s.sla_hours == 24 && s.wait_minutes >= 29 * 60, JSON.stringify(s));
await db.exec(`update public.admin_settings set value = '{"urgent":2,"high":8,"normal":48,"low":72}'::jsonb where key = 'support_sla_hours'`);
s = await one(`select overdue from public.admin_ticket_search('', 'active', null, null, false, null, 'wait', 10, 0)`);
check('응답 목표시간 설정을 바꾸면 초과 여부가 바뀐다', s.overdue === false);
await db.exec(`insert into public.support_messages (ticket_id, sender, body) values ('11111111-0000-4000-8000-000000000001', 'admin', '확인해 볼게요')`);
t = await one(`select admin_state, status, first_response_at is not null as fr from public.support_tickets where id = '11111111-0000-4000-8000-000000000001'`);
check('관리자 답변 → 고객 답변 대기(선생님 화면 status 는 answered)', t.admin_state === 'waiting_customer' && t.status === 'answered' && t.fr);
s = await one(`select overdue, wait_minutes from public.admin_ticket_search('', 'active', null, null, false, null, 'wait', 10, 0)`);
check('고객 답변 대기는 처리 지연이 아니다(대기 시간은 답변 시각부터)', s.overdue === false && s.wait_minutes < 5, JSON.stringify(s));
await db.exec(`select public.admin_ticket_set('11111111-0000-4000-8000-000000000001', 'resolved', 'high', 'incident-lightning', false)`);
t = await one(`select admin_state, priority, incident_key, resolved_at is not null as r from public.support_tickets where id = '11111111-0000-4000-8000-000000000001'`);
check('해결 처리 + 긴급도 + 장애 묶음', t.admin_state === 'resolved' && t.priority === 'high' && t.incident_key === 'incident-lightning' && t.r);
check('해결된 문의는 기본(처리 중) 목록에서 빠진다', (await q(`select 1 from public.admin_ticket_search('', 'active', null, null, false, null, 'wait', 10, 0)`)).length === 0);
await as(db, U1);
await db.exec(`insert into public.support_messages (ticket_id, sender, body) values ('11111111-0000-4000-8000-000000000001', 'user', '또 멈췄어요')`);
await as(db, ADMIN);
t = await one(`select admin_state, reopen_count, resolved_at from public.support_tickets where id = '11111111-0000-4000-8000-000000000001'`);
check('해결 뒤 고객이 다시 쓰면 재개(신규 + 재개 횟수)', t.admin_state === 'new' && t.reopen_count === 1 && t.resolved_at === null);
check('본문 검색', (await q(`select 1 from public.admin_ticket_search('멈췄어요', 'all', null, null, false, null, 'wait', 10, 0)`)).length === 1);
check('이메일 검색', (await q(`select 1 from public.admin_ticket_search('ONE@x', 'all', null, null, false, null, 'wait', 10, 0)`)).length === 1);
check('장애 묶음 필터', (await q(`select 1 from public.admin_ticket_search('', 'all', null, null, false, 'incident-lightning', 'wait', 10, 0)`)).length === 1);
await as(db, U2);
check('다른 사용자는 문의 검색 결과를 못 본다', (await q(`select 1 from public.admin_ticket_search('', 'all', null, null, false, null, 'wait', 10, 0)`)).length === 0);
await as(db, ADMIN);

// ================= 문제 목록(오늘 할 일) =================
console.log('\n[문제 목록]');
await db.exec(`insert into public.client_errors (fingerprint, message, page, user_id, academy_id, created_at) values
  ('fp1', 'TypeError: x is undefined', '/games/lightning', '${U1}', '${A1}', now() - interval '3 hours'),
  ('fp1', 'TypeError: x is undefined', '/games/lightning', '${U2}', '${A2}', now() - interval '2 hours')`);
await db.exec(`update public.academies set billing_failure_count = 2, card_last4 = '1111', plan = 'paid' where id = '${A2}'`);
await db.exec(`update public.support_tickets set last_user_msg_at = now() - interval '100 hours' where id = '11111111-0000-4000-8000-000000000001'`);
let r = (await one(`select public.admin_issues_sync() as r`)).r;
check('동기화: 오류·결제·문의 기한 초과 문제가 생긴다', r.new >= 3, JSON.stringify(r));
let list = await q(`select * from public.admin_issue_list(false)`);
check('우선순위 순서(결제 2 → 오류/문의 3)', list[0].severity <= list[list.length - 1].severity && list.some((i) => i.kind === 'billing') && list.some((i) => i.kind === 'error') && list.some((i) => i.kind === 'ticket'));
const err = list.find((i) => i.kind === 'error');
check('오류 문제: 영향 사용자·학원 수와 최초/최근 시각', err.users_affected === 2 && err.academies_affected === 2 && err.first_seen < err.last_seen);
await db.exec(`select public.admin_issue_set('${err.id}', 'acknowledged', null)`);
check('확인 중으로 바꾼다', (await one(`select status from public.admin_issues where id = '${err.id}'`)).status === 'acknowledged');
let e1 = null;
try { await db.exec(`select public.admin_issue_set('${err.id}', 'resolved', '')`); } catch (e) { e1 = e; }
check('해결은 메모 없이는 안 된다(확인과 해결 구분)', !!e1);
await db.exec(`select public.admin_issue_set('${err.id}', 'resolved', '번개 피하기 초기화 버그 수정')`);
await db.exec(`select public.admin_issues_sync()`);
check('해결 뒤 오래된 기록 때문에 되살아나지 않는다', (await one(`select status from public.admin_issues where id = '${err.id}'`)).status === 'resolved');
await db.exec(`insert into public.client_errors (fingerprint, message, page, user_id, academy_id) values ('fp1', 'TypeError: x is undefined', '/games/lightning', '${U1}', '${A1}')`);
r = (await one(`select public.admin_issues_sync() as r`)).r;
const again = await one(`select status, recurrence_count, recurred_at is not null as rec, resolved_at from public.admin_issues where id = '${err.id}'`);
check('해결 뒤 새로 난 오류는 재발로 되돌아온다', again.status === 'open' && again.recurrence_count === 1 && again.rec && again.resolved_at === null && r.recurred === 1, JSON.stringify([again, r]));
const grp = await one(`select status, recurrence_count, events, events_after_resolved from public.admin_error_groups(168) where fingerprint = 'fp1'`);
check('오류 묶음 목록도 재발 상태를 보여 준다', grp.status === 'open' && grp.recurrence_count === 1 && grp.events === 3, JSON.stringify(grp));
// 결제 문제는 신호가 사라지면 자동 해결
await db.exec(`update public.academies set billing_failure_count = 0 where id = '${A2}'`);
r = (await one(`select public.admin_issues_sync() as r`)).r;
const bill = await one(`select status, auto_resolved from public.admin_issues where issue_key = 'billing:${A2}'`);
check('결제 실패가 풀리면 자동 해결(자동 해결 표시)', bill.status === 'resolved' && bill.auto_resolved === true);
check('오류 문제는 자동으로 닫히지 않는다', (await one(`select count(*)::int as n from public.admin_issues where kind = 'error' and auto_resolved`)).n === 0);
await as(db, U1);
let denied = null;
try { await db.exec(`select public.admin_issues_sync()`); } catch (e) { denied = e; }
check('비관리자는 문제 동기화를 못 한다', !!denied);
check('비관리자는 문제 목록이 비어 있다', (await q(`select * from public.admin_issue_list(true)`)).length === 0);
await as(db, ADMIN);

// ================= 대량 변경 =================
console.log('\n[대량 변경]');
await db.exec(`insert into public.academies (id, name) select gen_random_uuid(), '대량' || g from generate_series(1, 25) g`);
const pre = (await one(`select public.admin_bulk_features_preview('대량', 'all', null, true, null, true, true) as p`)).p;
check('미리보기: 대상 수·바뀌는 수', pre.targets === 25 && pre.will_change === 25, JSON.stringify(pre));
check('미리보기는 학원 데이터를 바꾸지 않는다', Number((await one(`select count(*) as n from public.academies where features is not null`)).n) === 0);
let a1 = await one(`select public.admin_bulk_apply('${pre.batch_id}', '런칭 전 일괄 열기') as r`);
check('적용: 25곳 성공', a1.r.ok === 25 && a1.r.failed === 0 && a1.r.status === 'done', JSON.stringify(a1));
const a2 = await one(`select public.admin_bulk_apply('${pre.batch_id}', '런칭 전 일괄 열기') as r`);
check('같은 묶음을 다시 눌러도 한 번만 적용(중복 실행 방지)', a2.r.repeat === true && a2.r.ok === 25);
check('실제로 열렸다', Number((await one(`select count(*) as n from public.academies where name like '대량%' and (features ->> 'solo')::boolean`)).n) === 25);
const act = await one(`select reason, result, batch_id from public.admin_action_log(null, 1, 0)`);
check('조치 기록에 사유·결과·묶음 번호', act.reason === '런칭 전 일괄 열기' && act.result === 'success' && act.batch_id === pre.batch_id);
// 한 곳을 그 뒤에 바꾸면 되돌리기에서 건너뛴다
await db.exec(`update public.academies set features = '{"group": true, "solo": false, "homework": true}'::jsonb where name = '대량1'`);
const undo = (await one(`select public.admin_bulk_undo('${pre.batch_id}', '잘못 열었어요') as r`)).r;
check('되돌리기: 24곳 복구, 그 뒤 바뀐 1곳은 건너뜀', undo.restored === 24 && undo.skipped === 1, JSON.stringify(undo));
let e3 = null;
try { await db.exec(`select public.admin_bulk_apply('${pre.batch_id}', '재시도')`); } catch (e) { e3 = e; }
check('되돌린 묶음은 다시 적용되지 않는다', e3 === null);
const pre2 = (await one(`select public.admin_bulk_features_preview('', 'all', null, true, true, null, null) as p`)).p;
check('이미 같은 값이면 바뀌는 수에서 빠진다', pre2.will_change < pre2.targets);
let e4 = null;
try { await db.exec(`select public.admin_bulk_apply('${pre2.batch_id}', '')`); } catch (e) { e4 = e; }
check('사유 없이는 적용 불가', !!e4);
await as(db, U1);
let e5 = null;
try { await db.exec(`select public.admin_bulk_features_preview('', 'all', null, true, true, null, null)`); } catch (e) { e5 = e; }
check('비관리자는 대량 변경 미리보기도 못 한다', !!e5);
await as(db, ADMIN);

// ================= 삭제 안전장치 =================
console.log('\n[삭제]');
await db.exec(`select public.admin_delete_academy('${A1}')`);
check('일반 학원 삭제 = 14일 유예 요청(바로 지워지지 않음)', Number((await one(`select count(*) as n from public.academies where id = '${A1}'`)).n) === 1 && Number((await one(`select count(*) as n from public.academy_deletion_requests where academy_id = '${A1}'`)).n) === 1);
await db.exec(`select public.admin_cancel_deletion('${A1}', '실수로 요청')`);
check('유예 중 취소', Number((await one(`select count(*) as n from public.academy_deletion_requests where academy_id = '${A1}'`)).n) === 0);
await db.exec(`select public.admin_set_academy_test('${A2}', true, '삭제 연습용')`);
await db.exec(`select public.admin_delete_academy('${A2}')`);
check('테스트 학원은 바로 삭제', Number((await one(`select count(*) as n from public.academies where id = '${A2}'`)).n) === 0);

// ================= 안내 메시지 =================
console.log('\n[안내 메시지]');
await db.exec(`update public.academies set created_at = now() - interval '60 days'`);
await db.exec(`insert into public.academies (id, name, created_at, trial_ends_at) values ('dddddddd-0000-4000-8000-000000000001', '막 가입', now() - interval '1 hour', ((now() at time zone 'Asia/Seoul')::date + 13))`);
await db.exec(`insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000d1', 'new@x.com')`);
await db.exec(`insert into public.profiles (id, academy_id, role, display_name) values ('00000000-0000-4000-8000-0000000000d1', 'dddddddd-0000-4000-8000-000000000001', 'owner', '새원장')`);
const pv = (await one(`select public.admin_lifecycle_preview('welcome_first_use') as p`)).p;
check('미리보기: 새로 갈 곳 1', pv.new === 1 && pv.sample[0].email === 'new@x.com', JSON.stringify(pv));
const dry = (await one(`select public.admin_lifecycle_run('welcome_first_use', true) as r`)).r;
check('모의 실행: 아무것도 저장하지 않는다', dry.dry_run === true && Number((await one(`select count(*) as n from public.lifecycle_messages`)).n) === 0);
let e6 = null;
try { await db.exec(`select public.admin_lifecycle_run('welcome_first_use', false)`); } catch (e) { e6 = e; }
check('꺼진 작업은 실제 계획을 만들 수 없다', !!e6);
await db.exec(`select public.admin_job_set('welcome_first_use', true, 'live', 'email', '시범 켜기')`);
const live = (await one(`select public.admin_lifecycle_run('welcome_first_use', false) as r`)).r;
check('켜면 계획이 생긴다(1건)', live.planned === 1, JSON.stringify(live));
const live2 = (await one(`select public.admin_lifecycle_run('welcome_first_use', false) as r`)).r;
check('다시 돌려도 같은 안내는 중복 계획되지 않는다', live2.planned === 0 && Number((await one(`select count(*) as n from public.lifecycle_messages`)).n) === 1);
await db.exec(`select set_config('test.role', 'service_role', false)`);
const claim1 = await q(`select * from public.lifecycle_claim_batch('welcome_first_use', 10)`);
const claim2 = await q(`select * from public.lifecycle_claim_batch('welcome_first_use', 10)`);
check('발송 대기열: 한 번 집으면 다시 집히지 않는다', claim1.length === 1 && claim2.length === 0);
await db.exec(`select public.lifecycle_mark_result('${claim1[0].id}', false, 'smtp timeout')`);
check('실패 기록 + 다음 시도 시각(1시간 뒤)', (await one(`select status, attempts, last_error, next_attempt_at > now() + interval '30 minutes' as later from public.lifecycle_messages`)).later === true);
check('다음 시도 시각 전에는 집히지 않는다', (await q(`select * from public.lifecycle_claim_batch('welcome_first_use', 10)`)).length === 0);
await db.exec(`update public.lifecycle_messages set next_attempt_at = now() - interval '1 minute'`);
const c3 = await q(`select * from public.lifecycle_claim_batch('welcome_first_use', 10)`);
check('시간이 지나면 재시도(시도 2회)', c3.length === 1 && c3[0].attempts === 2);
await db.exec(`select public.lifecycle_mark_result('${c3[0].id}', false, 'again')`);
await db.exec(`update public.lifecycle_messages set next_attempt_at = now() - interval '1 minute'`);
const c4 = await q(`select * from public.lifecycle_claim_batch('welcome_first_use', 10)`);
await db.exec(`select public.lifecycle_mark_result('${c4[0].id}', false, 'third')`);
await db.exec(`update public.lifecycle_messages set next_attempt_at = now() - interval '1 minute'`);
check('최대 시도(3회) 뒤에는 더 집히지 않는다', (await q(`select * from public.lifecycle_claim_batch('welcome_first_use', 10)`)).length === 0);
await db.exec(`select set_config('test.role', '', false)`);
const rq = (await one(`select public.admin_lifecycle_retry_failed('welcome_first_use') as n`)).n;
check('실패 항목 재처리 = 대기열로 되돌림', rq === 1 && (await one(`select status, attempts from public.lifecycle_messages`)).attempts === 0);
const stop = (await one(`select public.admin_lifecycle_stop('welcome_first_use') as n`)).n;
check('작업 중지: 대기 건 취소 + 꺼짐', stop === 1 && (await one(`select enabled from public.automation_jobs where job_key = 'welcome_first_use'`)).enabled === false);
const jobs = await q(`select job_key, health from public.admin_jobs_status()`);
const hv = Object.fromEntries(jobs.map((j) => [j.job_key, j.health]));
check('꺼진 안내 작업은 꺼짐/모의만 해 봄으로 표시', ['disabled', 'dry_only'].includes(hv.trial_ending) && hv.welcome_first_use === 'dry_only', JSON.stringify(hv));
check('실행 기록이 없는 외부 작업은 "기록 없음"(정상으로 표시하지 않음)', hv.charge_subscriptions === 'no_record' && hv.weekly_report === 'no_record');
await db.exec(`select public.automation_record_run('charge_subscriptions', 'failed', 3, 1, 2, '결제사 오류', false)`);
check('실패한 외부 작업은 failed', (await one(`select health from public.admin_jobs_status() where job_key = 'charge_subscriptions'`)).health === 'failed');
await db.exec(`select public.admin_issues_sync()`);
check('실패한 작업은 문제 목록에 올라온다', (await q(`select 1 from public.admin_issues where issue_key = 'job:charge_subscriptions' and status = 'open'`)).length === 1);
await db.exec(`select public.automation_record_run('charge_subscriptions', 'success', 3, 3, 0, null, false)`);
check('성공하면 마지막 성공 시각이 갱신된다', (await one(`select health, last_success_at is not null as ok from public.admin_jobs_status() where job_key = 'charge_subscriptions'`)).ok === true);
await db.exec(`update public.automation_jobs set last_success_at = now() - interval '5 days', last_run_at = now() - interval '5 days' where job_key = 'ops_health_tick'`);
check('기대 주기를 넘도록 성공이 없으면 stale', (await one(`select health from public.admin_jobs_status() where job_key = 'ops_health_tick'`)).health === 'stale');

// ================= 결제 알림 =================
console.log('\n[결제 알림(웹훅)]');
await db.exec(`select set_config('test.role', 'service_role', false)`);
const rec = async (id, type, pid, ts) => (await one(`select public.payment_event_record('${id}', '${type}', '${pid}', '${ts}'::timestamptz, '{}'::jsonb) as r`)).r;
check('처음 알림은 기록', (await rec('wh-1', 'Transaction.Paid', 'pay-1', '2026-10-10T10:00:00Z')) === 'recorded');
check('같은 알림이 다시 오면 중복', (await rec('wh-1', 'Transaction.Paid', 'pay-1', '2026-10-10T10:00:00Z')) === 'duplicate');
check('같은 결제의 더 오래된 알림은 순서 역전(stale)', (await rec('wh-2', 'Transaction.Ready', 'pay-1', '2026-10-10T09:00:00Z')) === 'stale');
check('stale 도 장부에는 남는다', Number((await one(`select count(*) as n from public.payment_events`)).n) === 2);
await db.exec(`select set_config('test.role', '', false)`);
await as(db, U1);
let e7 = null;
try { await db.exec(`select set_config('test.role', 'authenticated', false); select public.payment_event_record('x', 't', 'p', now(), '{}'::jsonb)`); } catch (e) { e7 = e; }
check('일반 사용자는 웹훅 기록을 못 한다', !!e7);
await as(db, ADMIN);
await db.exec(`insert into public.academies (id, name, card_last4, plan) values ('eeeeeeee-0000-4000-8000-000000000001', '결제대사', '1234', 'paid')`);
await db.exec(`insert into public.billing_history (academy_id, billed_at, period_start, period_end, amount_krw, status, portone_payment_id) values
  ('eeeeeeee-0000-4000-8000-000000000001', now() - interval '3 days', current_date, current_date, 9900, 'success', 'pay-missing-event'),
  ('eeeeeeee-0000-4000-8000-000000000001', now() - interval '3 days', current_date, current_date, 9900, 'success', 'pay-1')`);
const rc = await q(`select kind, payment_id from public.admin_billing_reconcile()`);
check('대사: 알림이 없는 청구 성공 1건만 어긋남으로 표시', rc.length === 1 && rc[0].kind === 'paid_without_event' && rc[0].payment_id === 'pay-missing-event', JSON.stringify(rc));
const bo = (await one(`select public.admin_billing_overview() as o`)).o;
check('결제 요약: 환불 미기록 표시 + 금액 합계', bo.refunds_recorded === false && bo.amount_ok_30d_krw === 19800, JSON.stringify(bo));

summary();
