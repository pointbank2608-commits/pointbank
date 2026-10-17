// 지표·목록 SQL 검증(임시 Postgres = PGlite 위에서 실행 — 운영 DB 와 무관)
import { makeDb, as, check, summary } from './lib.mjs';

import { ALL_FILES as FILES } from './files.mjs';
const db = await makeDb(FILES);
const q = async (sql) => (await db.query(sql)).rows;
const one = async (sql) => (await q(sql))[0];

const ADMIN = '00000000-0000-4000-8000-000000000001';
const TEACHER = '00000000-0000-4000-8000-000000000002';
await db.exec(`
  insert into auth.users (id, email) values ('${ADMIN}', 'admin@x.com'), ('${TEACHER}', 'Teacher.Kim@Example.com');
  insert into public.academies (id, name) values ('aaaaaaaa-0000-4000-8000-000000000001', '관리 학원');
  insert into public.profiles (id, academy_id, role, display_name) values ('${ADMIN}', null, 'admin', '운영자');
`);

// ---- 한국 시간 날짜 경계 ----
const b = await one(`select (((now() at time zone 'Asia/Seoul')::date)::timestamp at time zone 'Asia/Seoul') as s`);
const start = b.s.toISOString();
await db.exec(`
  insert into public.academies (id, name, created_at) values
   ('bbbbbbbb-0000-4000-8000-000000000001', '경계 직전', '${start}'::timestamptz - interval '1 second'),
   ('bbbbbbbb-0000-4000-8000-000000000002', '경계 직후', '${start}'::timestamptz + interval '1 second'),
   ('bbbbbbbb-0000-4000-8000-000000000003', '6일 전 아침', '${start}'::timestamptz - interval '6 days' + interval '1 second'),
   ('bbbbbbbb-0000-4000-8000-000000000004', '7일 전 막판', '${start}'::timestamptz - interval '6 days' - interval '1 second');
`);
await as(db, ADMIN);
let ov = await one(`select public.admin_overview(true) as o`);
const o = ov.o;
const today = await q(`select name from public.admin_academy_search('', 'today', 100, 0) order by name`);
check('오늘 가입 카드 숫자 = 목록 수', today.length === o.signups_today, `${today.length} vs ${o.signups_today}`);
check('경계 직후는 오늘 가입', today.some((r) => r.name === '경계 직후'));
check('경계 직전은 오늘이 아니다', !today.some((r) => r.name === '경계 직전'));
const wk = await q(`select name from public.admin_academy_search('', 'new7', 100, 0)`);
check('최근 7일 가입 카드 숫자 = 목록 수', wk.length === o.signups_7d, `${wk.length} vs ${o.signups_7d}`);
check('6일 전 0시 직후는 7일에 포함', wk.some((r) => r.name === '6일 전 아침'));
check('7일 범위 밖(6일 전 0시 직전)은 제외', !wk.some((r) => r.name === '7일 전 막판'));
check('오늘 가입과 최근 7일 가입은 다르다', o.signups_7d > o.signups_today);

// ---- 이용 권한·제공 근거·결제 상태 ----
await db.exec(`
  insert into public.academies (id, name, plan, card_last4, next_billing_at) values ('cccccccc-0000-4000-8000-000000000001', '정기구독', 'paid', '1234', current_date + 20);
  insert into public.academies (id, name, plan) values ('cccccccc-0000-4000-8000-000000000002', '카드없는유료', 'paid');
  insert into public.academies (id, name, plan, card_last4, billing_failure_count) values ('cccccccc-0000-4000-8000-000000000003', '결제실패', 'paid', '9999', 2);
  insert into public.academies (id, name, plan, plan_status, card_last4) values ('cccccccc-0000-4000-8000-000000000004', '해지예약', 'paid', 'pending_cancel', '4444');
  insert into public.academies (id, name, trial_ends_at) values ('cccccccc-0000-4000-8000-000000000005', '무료', current_date - 30);
  insert into public.academies (id, name, trial_ends_at) values ('cccccccc-0000-4000-8000-000000000006', '체험임박', ((now() at time zone 'Asia/Seoul')::date + 2));
`);
const f = async (name) => await one(`select entitlement, source, billing_state from public.admin_academy_facts where name = '${name}'`);
check('카드 있는 유료 = 정기구독/정상', (await f('정기구독')).source === 'subscription' && (await f('정기구독')).billing_state === 'normal');
check('카드 없는 유료 = 미분류(오류로 단정하지 않음)', (await f('카드없는유료')).source === 'unclassified' && (await f('카드없는유료')).billing_state === 'none');
check('결제 실패 상태', (await f('결제실패')).billing_state === 'failed');
check('해지 예약 상태', (await f('해지예약')).billing_state === 'cancel_scheduled');
check('체험 끝난 무료', (await f('무료')).entitlement === 'free');
check('체험 중', (await f('체험임박')).entitlement === 'trial');

// 관리자 제공으로 바꾸면 사유 필수 + 전후 기록
let err = null;
try { await db.exec(`select public.admin_change_plan('cccccccc-0000-4000-8000-000000000002', 'paid', null, '', 'admin')`); } catch (e) { err = e; }
check('사유 없이는 플랜을 바꿀 수 없다', !!err);
await db.exec(`select public.admin_change_plan('cccccccc-0000-4000-8000-000000000002', 'paid', current_date + 30, '이벤트 당첨', 'event')`);
check('제공 근거가 event 로 기록된다', (await f('카드없는유료')).source === 'event');
const log = await one(`select reason, before, after from public.admin_action_log('cccccccc-0000-4000-8000-000000000002', 5, 0)`);
check('조치 기록에 사유·전후가 남는다', log.reason === '이벤트 당첨' && log.after.source === 'event' && log.before.source === 'unclassified', JSON.stringify(log));

// ---- 카드 숫자 = 목록 수 ----
ov = (await one(`select public.admin_overview(true) as o`)).o;
const eq = async (label, filter, expected) => {
  const n = Number((await one(`select count(*) as n from public.admin_academy_search('', '${filter}', 100, 0)`)).n);
  check(`카드=목록 ${label} (${expected})`, n === expected, `목록 ${n}`);
};
await eq('전체 기능', 'paid', ov.entitlement.full);
await eq('무료', 'free', ov.entitlement.free);
await eq('체험', 'trial', ov.entitlement.trial);
await eq('정기 구독', 'subscription', ov.source.subscription);
await eq('결제 실패+해지 예약', 'billing', ov.billing.failed + ov.billing.cancel_scheduled);
await eq('체험 3일 안 종료', 'trial_ending', ov.trial_ending_3d);
await eq('기간 한정 제공 7일 안 만료', 'expiring', ov.grants_expiring_7d);

// ---- 테스트 계정 제외 ----
await db.exec(`select public.admin_set_academy_test('cccccccc-0000-4000-8000-000000000001', true, '내부 점검용')`);
const ov2 = (await one(`select public.admin_overview(true) as o`)).o;
const ov3 = (await one(`select public.admin_overview(false) as o`)).o;
check('테스트 표시 학원은 통계에서 빠진다', ov2.academies === ov3.academies - 1 && ov2.source.subscription === ov3.source.subscription - 1);
check('기본 목록에서 테스트 학원이 빠진다', (await q(`select name from public.admin_academy_search('정기구독', 'all', 10, 0)`)).length === 0);
check('테스트 포함 옵션이면 보인다', (await q(`select name from public.admin_academy_search('정기구독', 'all', 10, 0, 'created', 'desc', false)`)).length === 1);
check('테스트 필터는 테스트 학원만', Number((await one(`select count(*) as n from public.admin_academy_search('', 'test', 10, 0)`)).n) === 1);
check('이름만 보고 자동 테스트 분류하지 않는다', Number((await one(`select count(*) as n from public.academies where is_test and name like '%테스트%'`)).n) === 0);

// ---- 선생님 이메일 검색(대소문자 무시) ----
await db.exec(`insert into public.profiles (id, academy_id, role, display_name) values ('${TEACHER}', 'aaaaaaaa-0000-4000-8000-000000000001', 'teacher', '김선생')`);
const em = await q(`select name from public.admin_academy_search('TEACHER.kim@example', 'all', 10, 0)`);
check('선생님 이메일(대소문자 무시)로 학원을 찾는다', em.length === 1 && em[0].name === '관리 학원', JSON.stringify(em));

// ---- 관리자 이외 접근 차단 ----
await as(db, TEACHER);
check('비관리자: 지표 null', (await one(`select public.admin_overview(true) as o`)).o === null);
check('비관리자: 학원 목록 0건', Number((await one(`select count(*) as n from public.admin_academy_search('', 'all', 10, 0)`)).n) === 0);
let e2 = null;
try { await db.exec(`select public.admin_change_plan('cccccccc-0000-4000-8000-000000000002', 'free', null, '해킹 시도', 'admin')`); } catch (e) { e2 = e; }
check('비관리자: 플랜 변경 거부', !!e2);
check('비관리자: 조치 기록 0건', Number((await one(`select count(*) as n from public.admin_action_log(null, 10, 0)`)).n) === 0);

summary();
