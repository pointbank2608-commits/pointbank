// 합성 데이터(계정 1만 개)로 관리자 주요 조회 시간을 잰다 — 임시 Postgres(PGlite, WASM)에서만, 운영 DB 와 무관.
// 이 숫자는 "이 노트북·WASM Postgres·연결 1개" 기준이다. 실제 Supabase(서버·네트워크·동시 접속)에서의 응답 시간을 보장하지 않는다.
import { makeDb, as, check, summary } from './lib.mjs';
import { ALL_FILES } from './files.mjs';

const ACADEMIES = 6500;
const ACCOUNTS = 10000; // 원장 6,500 + 선생님 3,500
const db = await makeDb(ALL_FILES);
const ADMIN = '00000000-0000-4000-8000-0000000000aa';

const t0 = Date.now();
await db.exec(`
  insert into auth.users (id, email, last_sign_in_at)
  select ('00000000-0000-4000-9000-' || lpad(g::text, 12, '0'))::uuid, 'user' || g || '@school' || (g % 700) || '.kr',
         case when g % 5 = 0 then null else now() - (random() * 60 || ' days')::interval end
    from generate_series(1, ${ACCOUNTS}) g;
  insert into auth.users (id, email) values ('${ADMIN}', 'admin@x.com');
  insert into public.academies (id, name, created_at, plan, card_last4, billing_failure_count, trial_ends_at)
  select ('aaaaaaaa-0000-4000-9000-' || lpad(g::text, 12, '0'))::uuid, '학원' || g, now() - (random() * 120 || ' days')::interval,
         case when g % 7 = 0 then 'paid' else 'free' end, case when g % 14 = 0 then '1234' end, case when g % 97 = 0 then 2 else 0 end,
         (now() at time zone 'Asia/Seoul')::date + ((g % 30) - 15)
    from generate_series(1, ${ACADEMIES}) g;
  insert into public.profiles (id, academy_id, role, display_name)
  select ('00000000-0000-4000-9000-' || lpad(g::text, 12, '0'))::uuid,
         ('aaaaaaaa-0000-4000-9000-' || lpad((case when g <= ${ACADEMIES} then g else (g % ${ACADEMIES}) + 1 end)::text, 12, '0'))::uuid,
         case when g <= ${ACADEMIES} then 'owner' else 'teacher' end, '이름' || g
    from generate_series(1, ${ACCOUNTS}) g;
  insert into public.profiles (id, academy_id, role, display_name) values ('${ADMIN}', null, 'admin', '운영자');
  insert into public.classes (academy_id, name) select id, 'A반' from public.academies where random() < 0.9;
  insert into public.students (academy_id, name)
  select a.id, '학생' || s from public.academies a, generate_series(1, 9) s;
  insert into public.support_tickets (academy_id, user_id, subject, category, last_user_msg_at, admin_state)
  select ('aaaaaaaa-0000-4000-9000-' || lpad(((g % ${ACADEMIES}) + 1)::text, 12, '0'))::uuid,
         ('00000000-0000-4000-9000-' || lpad(((g % ${ACADEMIES}) + 1)::text, 12, '0'))::uuid, '문의 ' || g, 'bug',
         now() - (random() * 200 || ' hours')::interval, (array['new', 'in_progress', 'waiting_customer', 'resolved'])[1 + g % 4]
    from generate_series(1, 4000) g;
  insert into public.support_messages (ticket_id, sender, body) select id, 'user', '본문 ' || subject from public.support_tickets;
  insert into public.client_errors (fingerprint, message, page, user_id, academy_id)
  select 'fp' || (g % 40), '오류 ' || (g % 40), '/games/x' || (g % 40),
         ('00000000-0000-4000-9000-' || lpad(((g % ${ACCOUNTS}) + 1)::text, 12, '0'))::uuid,
         ('aaaaaaaa-0000-4000-9000-' || lpad(((g % ${ACADEMIES}) + 1)::text, 12, '0'))::uuid
    from generate_series(1, 5000) g;
  insert into public.billing_history (academy_id, period_start, period_end, amount_krw, status, portone_payment_id)
  select a.id, current_date, current_date, 9900, case when random() < 0.05 then 'failed' else 'success' end, 'pay-' || a.id
    from public.academies a where a.plan = 'paid';
  analyze;
`);
console.log(`합성 데이터 준비: 학원 ${ACADEMIES}곳 · 계정 ${ACCOUNTS}개 · 학생 ${ACADEMIES * 9}명 · 문의 4,000건 · 오류 5,000건 (${((Date.now() - t0) / 1000).toFixed(1)}초)`);
await as(db, ADMIN);

const N = 15;
const bench = async (label, sql, limitMs) => {
  const times = [];
  let rows = 0;
  for (let i = 0; i < N; i += 1) {
    const s = performance.now();
    const r = await db.query(sql);
    times.push(performance.now() - s);
    rows = r.rows.length;
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(N / 2)];
  const p95 = times[Math.floor(N * 0.95) - 1];
  console.log(`  ${label}: 중앙값 ${p50.toFixed(0)}ms · p95 ${p95.toFixed(0)}ms · 행 ${rows}`);
  check(`${label} 가 ${limitMs}ms 안(p95)`, p95 < limitMs, `p95 ${p95.toFixed(0)}ms`);
};

await bench('지표 admin_overview', `select public.admin_overview(true)`, 1500);
await bench('학원 목록 첫 쪽(필터 없음)', `select * from public.admin_academy_search('', 'all', 50, 0)`, 1500);
await bench('학원 목록 이메일 일부 검색', `select * from public.admin_academy_search('school12.kr', 'all', 50, 0)`, 1500);
await bench('학원 목록 마지막 접속순', `select * from public.admin_academy_search('', 'paid', 50, 0, 'active', 'desc')`, 1500);
await bench('학원 목록 장기 미접속 유료', `select * from public.admin_academy_search('', 'dormant', 50, 0)`, 1500);
await bench('문의 검색(본문 포함)', `select * from public.admin_ticket_search('본문 문의 12', 'active', null, null, false, null, 'wait', 50, 0)`, 2000);
await bench('문의 목록(기한 초과순)', `select * from public.admin_ticket_search('', 'active', null, null, false, null, 'wait', 50, 0)`, 2000);
await bench('오류 묶음', `select * from public.admin_error_groups(168)`, 1500);
await bench('문제 동기화', `select public.admin_issues_sync()`, 3000);
await bench('작업 상태', `select * from public.admin_jobs_status()`, 500);

// 카드와 목록이 이 규모에서도 같은지
const ov = (await db.query(`select public.admin_overview(true) as o`)).rows[0].o;
for (const [f, n] of [['paid', ov.entitlement.full], ['trial', ov.entitlement.trial], ['free', ov.entitlement.free], ['subscription', ov.source.subscription], ['active7', ov.active_7d]]) {
  const c = Number((await db.query(`select count(*) as n from public.admin_academy_ids('', '${f}')`)).rows[0].n);
  check(`1만 계정 규모에서도 카드=목록 ${f} (${n})`, c === n, `목록 ${c}`);
}
check('회원(계정) 수와 학원 수는 다르다', ov.accounts === ACCOUNTS && ov.academies === ACADEMIES, JSON.stringify([ov.accounts, ov.academies]));
summary();
