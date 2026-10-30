// 093 영상 시청 기록 검증 — 임시 Postgres(PGlite)에 필요한 표만 흉내 내고 093a~e 를 적용해 실제로 돌려 본다.
// 실행: node test-watch.mjs   (먼저 이 폴더에서 npm install)
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SUPABASE_DIR, check, summary } from './lib.mjs';

const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create table academies (id uuid primary key default gen_random_uuid());
  create table students (id uuid primary key default gen_random_uuid(), name text);
  create table homework_assignments (id uuid primary key default gen_random_uuid(), academy_id uuid);
  create table homework_assignment_targets (assignment_id uuid, student_id uuid);
  create table homework_items (id uuid primary key default gen_random_uuid(), assignment_id uuid, position int default 0, config jsonb default '{}');
  create table homework_attempts (id uuid primary key default gen_random_uuid(), assignment_id uuid, student_id uuid, token uuid default gen_random_uuid(), last_seen_at timestamptz default now());
  create table homework_item_attempts (attempt_id uuid, item_id uuid, primary key (attempt_id, item_id));
  create function my_academy_id() returns uuid language sql as $$ select null::uuid $$;
  create function is_staff() returns boolean language sql as $$ select true $$;
  create function hw_staff_academy() returns uuid language sql as $$ select (select academy_id from homework_assignments limit 1) $$;
  create function hw_attempt_for(p_token uuid, p_read boolean default false) returns homework_attempts
    language plpgsql as $$ declare v homework_attempts; begin select * into v from homework_attempts where token = p_token; if v.id is null then raise exception 'not_found'; end if; return v; end $$;
`);
for (const f of ['093a_watch_tables.sql', '093b_watch_report.sql', '093c_watch_state.sql', '093d_watch_summary.sql', '093e_watch_grants.sql'])
  await db.exec(readFileSync(join(SUPABASE_DIR, f), 'utf8'));

const one = async (sql) => (await db.query(sql)).rows[0];
const ac = (await one(`insert into academies default values returning id`)).id;
const st = (await one(`insert into students (name) values ('하준') returning id`)).id;
const as_ = (await one(`insert into homework_assignments (academy_id) values ('${ac}') returning id`)).id;
await db.exec(`insert into homework_assignment_targets values ('${as_}', '${st}')`);
const it = (await one(`insert into homework_items (assignment_id, config) values ('${as_}', '{"watch": true, "targetViews": 2}') returning id`)).id;
const other = (await one(`insert into homework_items (assignment_id, config) values ('${as_}', '{}') returning id`)).id;
const tk = (await one(`insert into homework_attempts (assignment_id, student_id) values ('${as_}', '${st}') returning token`)).token;
const v1 = '11111111-1111-1111-1111-111111111111';
const v2 = '22222222-2222-2222-2222-222222222222';
const report = async (view, dur, watched) => (await one(`select hw_watch_report('${tk}', '${it}', '${view}', ${dur}, ${watched}) as r`)).r;

console.log('시청 기록(093)');
let r = await report(v1, 100, 95);
check('방금 시작했는데 95초를 봤다고 해도 실제 시간이 안 흘러서 인정 안 됨', r.completed === false && r.views === 0, JSON.stringify(r));
const w1 = (await one(`select watched_sec from homework_watch_views where view_key = '${v1}'`)).watched_sec;
check('본 시간은 흐른 시간 + 6초까지만 올라감', w1 <= 8, `watched=${w1}`);

await db.exec(`update homework_watch_views set started_at = now() - interval '120 seconds' where view_key = '${v1}'`);
r = await report(v1, 100, 80);
check('80초만 보면 90% 미만이라 인정 안 됨', r.completed === false);
r = await report(v1, 100, 95);
check('95초를 보고 시간도 흘렀으면 한 번 본 것으로 인정', r.completed === true && r.views === 1 && r.target === 2, JSON.stringify(r));
r = await report(v1, 100, 100);
check('같은 시청을 다시 알려도 횟수가 늘지 않음', r.views === 1);
r = await report(v1, 100, 10);
check('본 시간이 줄어들지 않음', (await one(`select watched_sec from homework_watch_views where view_key = '${v1}'`)).watched_sec >= 95);

r = await report(v2, 100, 100);
check('새 시청(v2)은 처음부터 다시 센다 — 바로 완료되지 않음', r.completed === false && r.views === 1);
await db.exec(`update homework_watch_views set started_at = now() - interval '120 seconds' where view_key = '${v2}'`);
r = await report(v2, 100, 100);
check('두 번째 시청 인정 → 2/2', r.completed === true && r.views === 2, JSON.stringify(r));

let err = '';
try { await one(`select hw_watch_report('${tk}', '${other}', '${v1}', 100, 100)`); } catch (e) { err = e.message; }
check('영상 숙제가 아닌 활동에는 기록할 수 없음', err.includes('not_found'), err);
err = '';
try { await one(`select hw_watch_report('00000000-0000-0000-0000-000000000000', '${it}', '${v1}', 100, 100)`); } catch (e) { err = e.message; }
check('모르는 열쇠는 거절', err.includes('not_found'), err);

const state = (await one(`select hw_watch_state('${tk}') as s`)).s;
check('학생 상태: 영상 1개, 목표 2, 본 날 2개', state.length === 1 && state[0].target === 2 && state[0].days.length === 2, JSON.stringify(state));

const sum = (await one(`select hw_watch_summary('${as_}') as s`)).s;
check('선생님 현황: 하준 2/2, 마지막 본 날 있음', sum.length === 1 && sum[0].name === '하준' && sum[0].views === 2 && sum[0].last_at, JSON.stringify(sum));

await db.exec(`update homework_watch_views set completed_at = null where view_key = '${v2}'`);
const sum2 = (await one(`select hw_watch_summary('${as_}') as s`)).s;
check('끝까지 못 본 시청은 "지금 보는 정도(%)"로 나옴', sum2[0].views === 1 && sum2[0].partial_pct === 100, JSON.stringify(sum2));

summary();
