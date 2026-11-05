// Regression test for the 099 compatibility boundary (wrappers around existing endpoints).
// Scenario 1: a later migration replaces a wrapped function -> protection must not vanish silently,
//             099 must not overwrite the newer body, and the failure must be explicit.
// Scenario 2: re-running 099 must not overwrite newer function bodies with old code; the explicit adopt step works.
// Also checks signatures, return types, privileges and actual behaviour, not just that names exist.
import assert from 'node:assert/strict';
import { buildFixture } from './learning-fixture.mjs';

const sig = (db, name) => db.query(
  `select pg_get_function_identity_arguments(p.oid) args, p.prorettype::regtype::text ret, p.prosecdef sd, p.prosrc src
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1`, [name]).then(r => r.rows);
const staff = (f) => f.db.exec(`set role authenticated;select set_config('test.staff','yes',false),set_config('test.academy','${f.A}',false)`);
const reset = (f) => f.db.exec('reset role');
const anon = (f) => f.db.exec('set role anon');
const apply099 = (f) => f.db.exec(f.read('099_learning_paths.sql'));
async function failing(f, fn, re) {
  await assert.rejects(fn, re);
  await f.db.exec('rollback'); // the failed migration runs as one explicit transaction
}
const WRAPPED = [
  ['solo_open', 'p_token uuid, p_assignment uuid'],
  ['student_home', 'p_token uuid'],
  ['solo_answer', 'p_token uuid, p_assignment uuid, p_step integer, p_value text'],
  ['solo_advance', 'p_token uuid, p_assignment uuid, p_step integer, p_unsure boolean'],
  ['solo_reveal', 'p_token uuid, p_assignment uuid, p_step integer'],
  ['solo_test_submit', 'p_token uuid, p_assignment uuid, p_step integer, p_answers jsonb'],
];

// ---------- A. fresh install: signatures, behaviour, idempotent re-run ----------
const f = await buildFixture();
await apply099(f);
for (const [name, args] of WRAPPED) {
  const [w] = await sig(f.db, name);
  const [l] = await sig(f.db, name + '_before_paths');
  assert.equal(w.args, args, `${name} wrapper signature`);
  assert.equal(l.args, args, `${name}_before_paths signature`);
  assert.equal(w.ret, 'jsonb'); assert.equal(l.ret, 'jsonb'); assert.equal(w.sd, true);
  assert.match(w.src, /learning-path-wrapper:v1/, `${name} carries the wrapper marker`);
  assert.doesNotMatch(l.src, /learning-path-wrapper/, `${name}_before_paths is legacy code`);
}
assert.equal((await f.one('select count(*)::int n from learning_path_compat')).n, 6);
assert.deepEqual((await f.one('select learning_path_compat_problems() p')).p, []);
const chk = (await f.db.query(f.read('099_check.sql'))).rows[0];
assert.ok(Object.keys(chk).includes('compat_boundary_intact') && Object.values(chk).every(v => v === true), '099_check.sql all true: ' + JSON.stringify(chk));

// behaviour: non-path lesson passes through to the legacy endpoint; path lesson is protected
await anon(f);
const legacyOut = await f.call('solo_open', f.TK, f.SA);
assert.equal(legacyOut.name, 'Test'); assert.equal(legacyOut.learning_path, undefined);
await reset(f);
await staff(f);
const cards = JSON.stringify([{ word: 'cat', meaning: '고양이', example: 'A cat sleeps.' }]);
const assigned = await f.call('learning_path_assign', crypto.randomUUID(), f.HW, [f.ST], '호환성 수업', cards, 'letters');
await reset(f);
const pathAssignment = (await f.one('select id from solo_assignments where lesson_id=$1', [assigned.lesson_id])).id;
await anon(f);
const pathOpen = await f.call('solo_open', f.TK, pathAssignment);
assert.equal(pathOpen.learning_path, true);
assert.equal(pathOpen.steps.length, 1, 'only the launch marker leaves solo_open for a path lesson');
await assert.rejects(() => f.call('solo_answer', f.TK, pathAssignment, 0, 'x'), /use_path_flow/);
await assert.rejects(() => f.call('solo_advance', f.TK, pathAssignment, 0, false), /use_path_flow/);
await assert.rejects(() => f.call('solo_reveal', f.TK, pathAssignment, 0), /use_path_flow/);
await assert.rejects(() => f.call('solo_test_submit', f.TK, pathAssignment, 0, '[]'), /use_path_flow/);
await assert.rejects(() => f.one('select solo_open_before_paths($1,$2)', [f.TK, f.SA]), /permission denied/, 'legacy copy is not callable by students');
await reset(f);

const bodies = async () => Object.fromEntries((await f.db.query(
  `select proname, md5(prosrc) h from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'solo\\_%' or proname like 'student\\_home%'`)).rows.map(r => [r.proname, r.h]));
const before = await bodies();
await apply099(f); // idempotent re-run on an intact install
assert.deepEqual(await bodies(), before, 're-running 099 changes nothing when the boundary is intact');
assert.deepEqual((await f.one('select learning_path_compat_problems() p')).p, []);

// ---------- B. a later migration replaces a wrapped function ----------
await f.db.exec(`create or replace function solo_open(p_token uuid,p_assignment uuid) returns jsonb language sql as $$select '{"v2":true}'::jsonb$$`);
const newerHash = (await bodies()).solo_open;
const problems = (await f.one('select learning_path_compat_problems() p')).p;
assert.ok(problems.includes('solo_open:wrapper_replaced'), 'replaced wrapper is detected, not silent: ' + problems);
assert.ok(problems.includes('solo_open:not_security_definer'));
await staff(f);
await assert.rejects(() => f.call('learning_path_assign', crypto.randomUUID(), f.HW, [f.ST], '다른 수업', cards, 'letters'), /learning_path_protection_changed.*solo_open:wrapper_replaced/);
const summary = await f.call('learning_path_teacher_summary', f.HW);
assert.ok(summary.protection.includes('solo_open:wrapper_replaced'), 'teacher summary reports the broken boundary');
await reset(f);
// 099 must stop instead of overwriting the newer body with the old wrapper/legacy code
await failing(f, () => apply099(f), /compat_newer_function.*learning_path_adopt_legacy/);
const afterFail = await bodies();
assert.equal(afterFail.solo_open, newerHash, 'newer solo_open body survived the failed re-run');
assert.equal(afterFail.solo_open_before_paths, before.solo_open_before_paths, 'legacy copy untouched by the failed re-run');

// ---------- C. explicit adoption, then re-run keeps the newer behaviour ----------
for (const role of ['anon', 'authenticated']) {
  await f.db.exec(`set role ${role}`);
  await assert.rejects(() => f.call('learning_path_adopt_legacy', 'solo_open', 'uuid,uuid'), /permission denied/, `${role} cannot adopt`);
  await assert.rejects(() => f.call('learning_path_wrap_legacy', 'solo_open', 'uuid,uuid'), /permission denied/, `${role} cannot wrap`);
  await f.db.exec('reset role');
}
await f.db.exec(`select learning_path_adopt_legacy('solo_open','uuid,uuid')`);
assert.match((await sig(f.db, 'solo_open_before_paths'))[0].src, /v2/, 'newer body became the legacy behaviour');
await f.db.exec(`select 1 where to_regprocedure('public.solo_open(uuid,uuid)') is null`);
assert.equal((await f.one(`select to_regprocedure('public.solo_open(uuid,uuid)') is null as gone`)).gone, true);
await apply099(f);
assert.deepEqual((await f.one('select learning_path_compat_problems() p')).p, []);
await anon(f);
const nonPath = await f.call('solo_open', f.TK, f.SA);
assert.equal(nonPath.v2, true, 'non-path lessons now get the newer legacy behaviour');
const stillProtected = await f.call('solo_open', f.TK, pathAssignment);
assert.equal(stillProtected.learning_path, true); assert.equal(stillProtected.v2, true);
assert.equal(stillProtected.steps.length, 1);
await assert.rejects(() => f.call('solo_answer', f.TK, pathAssignment, 0, 'x'), /use_path_flow/);
await reset(f);
await assert.rejects(() => f.db.exec(`select learning_path_adopt_legacy('solo_open','uuid,uuid')`), /compat_already_wrapped/, 'adopting a wrapper is refused');

// Retaining the marker must not hide changed code/settings or allow silent overwrites.
await f.db.exec(`create or replace function solo_open(p_token uuid,p_assignment uuid) returns jsonb language plpgsql security definer set search_path=public as $$
-- learning-path-wrapper:v1
begin return '{"marker_kept":true}'::jsonb; end$$`);
assert.ok((await f.one('select learning_path_compat_problems() p')).p.includes('solo_open:wrapper_definition_changed'));
await failing(f, () => apply099(f), /compat_newer_function/);
assert.equal((await f.call('solo_open', f.TK, f.SA)).marker_kept, true, 'changed body survives refused migration');
await f.db.exec(`select learning_path_adopt_legacy('solo_open','uuid,uuid')`);
await apply099(f);
assert.equal((await f.call('solo_open', f.TK, f.SA)).marker_kept, true, 'explicit adoption supports retained markers');
await f.db.exec('alter function solo_open(uuid,uuid) set search_path=public,pg_temp');
assert.ok((await f.one('select learning_path_compat_problems() p')).p.includes('solo_open:wrapper_definition_changed'));
await failing(f, () => apply099(f), /compat_newer_function/);
await f.db.exec('alter function solo_open(uuid,uuid) set search_path=public');
assert.deepEqual((await f.one('select learning_path_compat_problems() p')).p, []);
await f.db.exec("update learning_path_compat set wrapper_hash=null where fn='solo_open'");
await failing(f, () => apply099(f), /compat_newer_function/);
await f.db.exec("update learning_path_compat set wrapper_hash=learning_path_wrapper_hash('solo_open(uuid,uuid)'::regprocedure) where fn='solo_open'");

// ---------- D. exposed legacy copy / dropped legacy ----------
await f.db.exec('grant execute on function solo_answer_before_paths(uuid,uuid,int,text) to anon');
assert.ok((await f.one('select learning_path_compat_problems() p')).p.includes('solo_answer:legacy_exposed'));
await f.db.exec('revoke all on function solo_answer_before_paths(uuid,uuid,int,text) from anon,public');
assert.deepEqual((await f.one('select learning_path_compat_problems() p')).p, []);
await f.db.exec('drop function solo_reveal_before_paths(uuid,uuid,int)');
assert.ok((await f.one('select learning_path_compat_problems() p')).p.includes('solo_reveal:legacy_missing'));
await failing(f, () => apply099(f), /compat_inconsistent/);

// ---------- E. preflight uses signatures and return types ----------
const g = await buildFixture();
await g.db.exec('drop function solo_reveal(uuid,uuid,int)');
await failing(g, () => apply099(g), /missing or incompatible: .*solo_reveal/);
const h = await buildFixture();
await h.db.exec('drop function solo_open(uuid,uuid)');
await h.db.exec(`create function solo_open(p_token uuid,p_assignment uuid) returns text language sql as $$select 'x'::text$$`);
await failing(h, () => apply099(h), /missing or incompatible: .*solo_open/);
const k = await buildFixture();
await k.db.exec('drop function solo_answer(uuid,uuid,int,text)');
await k.db.exec(`create function solo_answer(p_token uuid,p_assignment uuid,p_step int) returns jsonb language sql as $$select '{}'::jsonb$$`);
await failing(k, () => apply099(k), /missing or incompatible: .*solo_answer/);
assert.equal((await k.one(`select to_regclass('public.learning_path_plans') is null as none`)).none, true, 'failed preflight leaves nothing behind');

await Promise.all([f,g,h,k].map(x => x.db.close()));
console.log('Compat boundary: retained-marker/body/settings fingerprint protection, signatures/return types/privileges, intact re-run, newer function detected and never overwritten, explicit adopt, exposed/dropped legacy and preflight signature checks passed.');
