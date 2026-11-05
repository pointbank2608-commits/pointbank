import { buildAdaptiveFixture } from './adaptive-homework-fixture.mjs';
// Multi-connection concurrency check for the 097/098/099 learning-path SQL on a REAL PostgreSQL server.
//
//   LEARNING_TEST_DISPOSABLE=yes PG_ADMIN_URL=postgres://postgres:secret@localhost:5432/postgres node scripts/admin/test-learning-concurrency.mjs
//
// Needs: a PostgreSQL 14+ server, a role that may CREATE DATABASE / CREATE ROLE (e.g. superuser), and the `pg` package
// (`npm install --no-save --package-lock=false --ignore-scripts pg` inside app/scripts/admin). It creates a scratch database, loads the same synthetic
// fixture as the PGlite tests, applies 097/098/099 and runs the scenarios below with separate connections.
// Creates cluster-wide fixture roles as well as a scratch DB. Requires explicit disposable localhost acknowledgement.
// Never use a shared server, production, or Supabase.
//
//   --pglite-smoke   run the same scenarios SERIALLY on PGlite. This only proves the scenario code and SQL are valid;
//                    it is NOT a concurrency verification and prints that clearly.
//   --workers=N      concurrent connections per scenario (default 8)    --rounds=N   repetitions (default 5)
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { buildFixture } from './learning-fixture.mjs';

const args = new Map(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const SMOKE = args.has('pglite-smoke');
const WORKERS = Number(args.get('workers') ?? 8);
const ROUNDS = Number(args.get('rounds') ?? 5);
assert.ok(Number.isInteger(WORKERS) && WORKERS >= 2 && WORKERS <= 32, '--workers must be an integer 2..32');
assert.ok(Number.isInteger(ROUNDS) && ROUNDS >= 1 && ROUNDS <= 50, '--rounds must be an integer 1..50');
if (!SMOKE && process.env.PG_ADMIN_URL) {
  const target = new URL(process.env.PG_ADMIN_URL);
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(target.hostname) && process.env.LEARNING_TEST_DISPOSABLE === 'yes',
    'Refusing target: use an isolated localhost PostgreSQL and LEARNING_TEST_DISPOSABLE=yes (creates cluster-wide fixture roles)');
}
const pgOptions = connectionString => ({ connectionString, connectionTimeoutMillis: 5000,
  query_timeout: 20000, statement_timeout: 15000, lock_timeout: 8000 });

let pg = null;
if (!SMOKE) {
  pg = await import('pg').then(m => m.default ?? m).catch(() => null);
  if (!pg || !process.env.PG_ADMIN_URL) {
    console.log('NOT RUN: real PostgreSQL concurrency verification needs PG_ADMIN_URL and the `pg` package.\n' +
      '  1) start a throw-away PostgreSQL 14+ (e.g. docker run --rm -p 127.0.0.1:5432:5432 -e POSTGRES_PASSWORD=secret postgres:16)\n' +
      '  2) cd app/scripts/admin && npm install --no-save --package-lock=false --ignore-scripts pg\n' +
      '  3) LEARNING_TEST_DISPOSABLE=yes PG_ADMIN_URL=postgres://postgres:secret@localhost:5432/postgres node scripts/admin/test-learning-concurrency.mjs\n' +
      'Add --pglite-smoke to only validate the scenario code (serial, NOT a concurrency result).');
    process.exit(2);
  }
}

// ---------- connections ----------
const dbName = 'learning_conc_' + Math.random().toString(36).slice(2, 10);
let adminClient, scratchUrl, db, created = false; const open = new Set();
const closeClient = async client => { try { await client.end(); } finally { open.delete(client); } };
const wrapPg = (client) => ({
  close: () => closeClient(client),
  exec: (sql) => client.query(sql.replace(/create role anon;\s*create role authenticated;/, '')),
  query: (sql, params) => client.query(sql, params),
});
async function makeAdminDb() {
  if (SMOKE) return new PGlite();
  adminClient = new pg.Client(pgOptions(process.env.PG_ADMIN_URL));
  await adminClient.connect();
  await adminClient.query(`create database ${dbName}`); created = true;
  await adminClient.query(`do $$ begin create role anon; exception when duplicate_object then null; end $$`);
  await adminClient.query(`do $$ begin create role authenticated; exception when duplicate_object then null; end $$`);
  const u = new URL(process.env.PG_ADMIN_URL); u.pathname = '/' + dbName; scratchUrl = u.toString();
  const c = new pg.Client(pgOptions(scratchUrl)); open.add(c); await c.connect();
  await c.query('grant anon, authenticated to current_user');
  return wrapPg(c);
}
async function worker(sharedDb) {
  if (SMOKE) return sharedDb;
  const c = new pg.Client(pgOptions(scratchUrl)); open.add(c); await c.connect();
  return wrapPg(c);
}
// concurrent in real mode; serial in smoke mode (a shared PGlite session cannot interleave roles safely)
const runAll = async (fns) => {
  if (!SMOKE) {
    // Every prepared connection waits on the same gate before issuing the contending query.
    let release; const gate = new Promise(resolve => { release = resolve; });
    const pending = fns.map(async fn => { await gate; return fn(); });
    release(); return Promise.allSettled(pending);
  }
  const out = [];
  for (const fn of fns) { try { out.push({ status: 'fulfilled', value: await fn() }); } catch (reason) { out.push({ status: 'rejected', reason }); } }
  return out;
};

try {
db = await makeAdminDb();
const f = args.has('homework') ? await buildAdaptiveFixture(db) : await buildFixture(db);
if (!args.has('homework')) await db.exec(f.read('099_learning_paths.sql'));
if (args.has('research') && !args.has('homework')) {
  await db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid$$`);
  await db.exec(f.read('100_learning_research.sql'));
}
if (args.has('fail-after-setup')) throw new Error('Intentional cleanup verification failure');
const { A, HW, ST, TK } = f;
const cards = JSON.stringify([{ word: 'cat', meaning: '고양이', example: 'A cat sleeps.' }]);
const message = (r) => String(r.reason?.message ?? r.reason);
const isDeadlock = (r) => r.status === 'rejected' && (r.reason?.code === '40P01' || /deadlock/i.test(message(r)));
const ok = (rs) => rs.filter(r => r.status === 'fulfilled');
const errs = (rs) => rs.filter(r => r.status === 'rejected');
const KNOWN = /path_changed|not_due|bad_request|request_changed/;

async function newAssignment(title) {
  await db.exec(`set role authenticated;select set_config('test.staff','yes',false),set_config('test.academy','${A}',false)`);
  const r = (await db.query('select learning_path_assign($1,$2,$3,$4,$5,$6) as r', [crypto.randomUUID(), HW, [ST], title, cards, 'letters'])).rows[0].r;
  await db.exec('reset role');
  return (await db.query('select id from solo_assignments where lesson_id=$1', [r.lesson_id])).rows[0].id;
}
const stateOf = async (a) => (await db.query('select * from learning_path_states where assignment_id=$1', [a])).rows[0];
const count = async (sql, p = []) => Number((await db.query(sql, p)).rows[0].n);
const asStudent = async (w) => { await w.exec('set role anon'); return w; };
const call = (w, name, ...a) => w.query(`select ${name}(${a.map((_, i) => '$' + (i + 1)).join(',')}) as r`, a).then(x => x.rows[0].r);
const openPath = (w, a) => call(w, 'learning_path_open', TK, a);
const act = (w, a, req, pos, action, value = null) => call(w, 'learning_path_action', TK, a, req, pos, action, value);
const noDeadlock = (rs, label) => { assert.equal(rs.filter(isDeadlock).length, 0, `${label}: deadlock detected`); const odd = errs(rs).filter(r => !KNOWN.test(message(r))); assert.equal(odd.length, 0, `${label}: unexpected errors: ${odd.map(message).join(' | ')}`); };

async function withWorkers(n, fn) {
  const ws = [];
  try {
    for (let i = 0; i < n; i++) ws.push(await asStudent(await worker(db)));
    return await runAll(ws.map((w, i) => () => fn(w, i)));
  } finally { if (!SMOKE) await Promise.all(ws.map(w => w.close())); }
}

for (let round = 1; round <= ROUNDS; round++) {
  // 1. the same assignment opened by many connections at once
  let a = await newAssignment('동시 열기 ' + round);
  let rs = await withWorkers(WORKERS, (w) => openPath(w, a));
  noDeadlock(rs, 'concurrent open'); assert.equal(ok(rs).length, WORKERS, 'every open succeeds');
  await db.exec('reset role');
  assert.equal(await count('select count(*) n from learning_path_states where assignment_id=$1', [a]), 1, 'one state row');
  const st1 = await stateOf(a); assert.equal(st1.position, 1); assert.equal(st1.round, 0);
  assert.ok(await count('select count(*) n from learning_delivery_runs where id=$1', [st1.run_id]) === 1, 'state points at a real run');

  // 2. same position answered with DIFFERENT request ids at once: exactly one advances
  rs = await withWorkers(WORKERS, (w) => act(w, a, crypto.randomUUID(), 1, 'answer', 'cat'));
  noDeadlock(rs, 'concurrent answers'); assert.equal(ok(rs).length, 1, 'exactly one answer for a position succeeds');
  assert.equal(errs(rs).filter(r => /path_changed/.test(message(r))).length, WORKERS - 1, 'others see the position moved on');
  await db.exec('reset role');
  const st2 = await stateOf(a); assert.equal(st2.position, 4, 'skipped nothing and advanced once (diagnostic correct -> check)');
  assert.equal(await count('select count(*) n from learning_path_requests where assignment_id=$1', [a]), 1, 'one stored request');
  assert.equal(await count('select count(*) n from solo_step_events where assignment_id=$1', [a]), 1, 'one graded observation');

  // 3. SAME request id retried concurrently: identical result, one effect
  const req = crypto.randomUUID();
  rs = await withWorkers(WORKERS, (w) => act(w, a, req, 4, 'answer', 'cat'));
  noDeadlock(rs, 'concurrent retries'); assert.equal(ok(rs).length, WORKERS, 'every retry returns the stored result');
  assert.equal(new Set(ok(rs).map(r => JSON.stringify(r.value))).size, 1, 'identical result for every retry');
  await db.exec('reset role');
  assert.equal(await count('select count(*) n from learning_path_checks where assignment_id=$1', [a]), 1, 'one check recorded');
  assert.equal(await count('select count(*) n from solo_step_events where assignment_id=$1', [a]), 2, 'no duplicated observation');
  assert.equal((await stateOf(a)).round, 1);

  // 4. same request id, different payload at once: one winner, rest rejected, one stored effect
  await db.query("update learning_path_states set due_at=now()-interval '1 hour' where assignment_id=$1", [a]);
  const req2 = crypto.randomUUID();
  rs = await withWorkers(4, (w, i) => act(w, a, req2, 4, 'answer', i % 2 ? 'cat' : 'dog'));
  noDeadlock(rs, 'same request, different payload');
  await db.exec('reset role');
  assert.ok(ok(rs).length >= 1 && errs(rs).every(r => /bad_request/.test(message(r))), 'conflicting reuse of a request id is rejected');
  assert.equal(await count('select count(*) n from learning_path_requests where id=$1', [req2]), 1);
  assert.equal(await count('select count(*) n from learning_path_checks where assignment_id=$1 and round=1', [a]), 1);

  // 5. completion: open + last answers racing; finishes exactly once
  await db.query("update learning_path_states set due_at=now()-interval '1 hour' where assignment_id=$1", [a]);
  const pos = (await stateOf(a)).position;
  const mixed = [];
  for (let i = 0; i < WORKERS; i++) mixed.push(async (w) => (i % 2 ? openPath(w, a) : act(w, a, crypto.randomUUID(), pos, 'answer', 'cat')));
  rs = await withWorkers(WORKERS, (w, i) => mixed[i](w));
  noDeadlock(rs, 'open vs completion');
  await db.exec('reset role');
  assert.equal(await count('select count(*) n from learning_path_checks where assignment_id=$1 and round=2', [a]) <= 1, true, 'at most one round-2 check');
  await db.query("update learning_path_states set due_at=now()-interval '1 hour' where assignment_id=$1 and finished_at is null", [a]);
  const last = await stateOf(a);
  if (!last.finished_at) {
    const w = await asStudent(await worker(db)); try { await act(w, a, crypto.randomUUID(), last.position, 'answer', 'cat'); } finally { if (!SMOKE) await w.close(); } await db.exec('reset role');
  }
  const done = await stateOf(a); assert.ok(done.finished_at, 'path finished');
  assert.equal(await count('select count(*) n from learning_path_checks where assignment_id=$1', [a]), 3, 'exactly three checks (first, +1 day, +7 days)');
  assert.ok((await db.query('select finished_at from solo_assignments where id=$1', [a])).rows[0].finished_at, 'assignment marked finished once');

  // 6. teacher approval retried concurrently with the same request id: one lesson
  const planReq = crypto.randomUUID();
  const staff = []; for (let i = 0; i < 4; i++) { const w = await worker(db); await w.exec(`set role authenticated;select set_config('test.staff','yes',false),set_config('test.academy','${A}',false)`); staff.push(w); }
  try { rs = await runAll(staff.map(w => () => call(w, 'learning_path_assign', planReq, HW, [ST], '중복 승인 ' + round, cards, 'letters'))); }
  finally { if (!SMOKE) await Promise.all(staff.map(w => w.close())); }
  noDeadlock(rs, 'duplicate teacher approval');
  await db.exec('reset role');
  assert.equal(ok(rs).length, 4, 'all retries answered');
  assert.equal(new Set(ok(rs).map(r => r.value.lesson_id)).size, 1, 'one lesson for one approval request');
  assert.equal(await count('select count(*) n from learning_path_plans p where p.lesson_id=$1', [ok(rs)[0].value.lesson_id]), 1);
  if (args.has('research')) {
    await db.exec(`select set_config('test.admin','yes',false)`);
    const report=await call(db,'admin_learning_research',30,A);
    const decisionReq=crypto.randomUUID();
    const reviewWorkers=[];
    try {
      for (let i=0;i<4;i++) {
        const w=await worker(db); reviewWorkers.push(w);
        await w.exec("set role authenticated;select set_config('test.admin','yes',false)");
      }
      const reviews=await runAll(reviewWorkers.map(w=>()=>call(w,'admin_learning_research_decide',decisionReq,30,A,'practice','compare','concurrent review',report.evidence_hash)));
      noDeadlock(reviews,'concurrent admin review');assert.equal(ok(reviews).length,4);
      assert.equal(ok(reviews).filter(r=>!r.value.duplicate).length,1,'one committed review, others are idempotent receipts');
    } finally { if (!SMOKE) await Promise.all(reviewWorkers.map(w=>w.close())); }
    await db.exec('reset role');
    assert.equal(await count('select count(*) n from learning_research_decisions where request_id=$1',[decisionReq]),1);
  }
  if (args.has('homework')) {
    const request = crypto.randomUUID(), workers=[];
    try {
      for (let i=0;i<WORKERS;i++) {
        const w=await worker(db);workers.push(w);
        await w.exec(`set role authenticated;select set_config('test.staff','yes',false),set_config('test.academy','${A}',false)`);
      }
      const approvals=await runAll(workers.map(w=>()=>call(w,'learning_homework_assign',request,HW,[ST],'Adaptive concurrent '+round,cards,'letters',4,null,'manual',null)));
      noDeadlock(approvals,'adaptive homework approval');
      assert.equal(ok(approvals).length,WORKERS);
      assert.equal(ok(approvals).filter(x=>!x.value.duplicate).length,1);
      const id=ok(approvals)[0].value.lesson_id;
      assert.equal(new Set(ok(approvals).map(x=>x.value.lesson_id)).size,1);
      await db.exec('reset role');
      assert.equal(await count('select count(*) n from learning_homework_plans where lesson_id=$1',[id]),1);
      assert.equal(await count("select count(*) n from solo_assignments where lesson_id=$1 and kind='homework'",[id]),1);
    } finally {if(!SMOKE)await Promise.all(workers.map(w=>w.close()));}
  }
  console.log(`round ${round}/${ROUNDS} ok`);
}

if (args.has('homework')) console.log('Adaptive homework extension: concurrent approval creates one approval receipt and one assignment.');
if (args.has('research')) console.log('Research extension: actual aggregate queries and concurrent same-request admin decisions passed.');
console.log(SMOKE
  ? 'SMOKE ONLY (serial PGlite): scenario code and SQL are valid. This is NOT a multi-connection concurrency verification.'
  : `Real PostgreSQL concurrency: ${ROUNDS} rounds x ${WORKERS} connections - no deadlock, no duplicate records, no skipped progress, single completion, idempotent retries.`);

} finally {
  // Covers setup/fixture/scenario failures too. Only drop the exact database this process created.
  await Promise.allSettled([...open].map(closeClient));
  try {
    if (created) {
      assert.match(dbName, /^learning_conc_[a-z0-9]{1,10}$/);
      await adminClient.query(`drop database ${dbName} with (force)`);
    }
  } finally {
    if (adminClient) await adminClient.end();
    if (SMOKE && db) await db.close();
  }
}
