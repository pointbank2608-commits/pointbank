import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { applyWmPortalFix, makeWmDb, setDay } from './wm-setup.mjs';
import { as } from './lib.mjs';
import { buildFixture } from './learning-fixture.mjs';

const db = await makeWmDb();
const sql = readFileSync(new URL('../../../supabase/103_word_projects.sql', import.meta.url), 'utf8');
const query = async (text, params = []) => (await db.query(text, params)).rows;
const one = async (text, params = []) => (await query(text, params))[0];
const call = async (fn, ...args) => (await one('select public.' + fn + '(' + args.map((_, i) => '$' + (i + 1)).join(',') + ') as value', args)).value;
const teacher = randomUUID();
const outsider = randomUUID();
const academy = randomUUID();
const otherAcademy = randomUUID();
const classId = randomUUID();
const student = randomUUID();
const studentB = randomUUID();
const portal = randomUUID();
const cards = Array.from({ length: 3500 }, (_, i) => ({ word: 'word' + i, meaning: '뜻' + i }));

try {
  await db.exec(sql);
  await db.exec(sql);
  await db.exec(readFileSync(new URL('../../../supabase/104_word_project_adaptive_pace.sql', import.meta.url), 'utf8'));
  await query('insert into auth.users(id,email) values ($1,$2),($3,$4)', [teacher, 'qa@test.invalid', outsider, 'other@test.invalid']);
  await query("insert into public.academies(id,name,features) values ($1,'QA A','{\"homework\":true}'),($2,'QA B','{\"homework\":true}')", [academy, otherAcademy]);
  await query("insert into public.profiles(id,academy_id,role,display_name) values ($1,$2,'owner','QA teacher'),($3,$4,'owner','Other teacher')", [teacher, academy, outsider, otherAcademy]);
  await query("insert into public.classes(id,academy_id,name) values ($1,$2,'QA class')", [classId, academy]);
  await query("insert into public.students(id,academy_id,class_id,name) values ($1,$3,$4,'QA student'),($2,$3,$4,'QA student B')", [student, studentB, academy, classId]);
  await query('insert into public.student_sessions(token,student_id) values ($1,$2)', [portal, student]);
  await setDay(db, '2026-11-01');
  await as(db, teacher);
  const request = randomUUID();
  const assign = (id, title, range, people = [student]) => call('wm_project_assign', id, classId, title, range, { type: 'wordlist' }, people, 'plus', 3, 0);
  const project = await assign(request, 'Entire saved list', cards);
  assert.equal(project.words, 3500);
  assert.equal(project.created, 1);
  const retry = await assign(request, 'Entire saved list', cards);
  assert.equal(retry.plan_id, project.plan_id);
  assert.equal(retry.duplicate, true);
  await assert.rejects(assign(request, 'Changed approved title', cards), /request_conflict/);
  assert.equal((await call('wm_plan_cards', project.plan_id, 3451, 3500)).length, 50);
  const progress = await call('wm_plan_progress', project.plan_id);
  assert.equal(progress.need_to_graduate, 3500);
  assert.equal(progress.daily_mode, 'plus');
  assert.equal(progress.students[0].current_mode, 'plus');
  assert.equal(progress.start_date, '2026-11-01');
  assert.equal(progress.today, progress.start_date);
  assert.equal(progress.goal_date, progress.final_deadline);
  const target = await one('select id,access_token from public.wm_targets where plan_id=$1', [project.plan_id]);
  const firstDay = await call('wm_today_state', target.access_token);
  assert.equal(firstDay.counts.new, 10);
  assert.equal((await call('wm_today_state', target.access_token)).session_id, firstDay.session_id);
  assert.equal(firstDay.project.unconfirmed, 3500);
  assert.ok(firstDay.items.every(item => !Object.hasOwn(item, 'key') && !Object.hasOwn(item, 'correct')));
  const ack = firstDay.items.find(item => item.kind === 'study');
  await call('wm_ack', target.access_token, firstDay.session_id, ack.i, randomUUID());
  const firstAsk = firstDay.items.find(item => item.kind === 'ask');
  const submitted = randomUUID();
  const privateQuestion = (await one('select questions->$2::int as q from public.wm_sessions where id=$1', [firstDay.session_id, firstAsk.i])).q;
  const response = privateQuestion.qtype === 'order' ? JSON.stringify(privateQuestion.correct) : String(privateQuestion.correct);
  const graded = await call('wm_answer', target.access_token, firstDay.session_id, firstAsk.i, response, submitted);
  assert.equal(graded.first, true);
  assert.equal(graded.correct, true);
  assert.equal((await one('select project_evidence from public.wm_answers where client_id=$1', [submitted])).project_evidence, false);
  assert.equal((await call('wm_answer', target.access_token, firstDay.session_id, firstAsk.i, response, submitted)).first, false);
  const nextAsk = firstDay.items.find(item => item.kind === 'ask' && item.i !== firstAsk.i);
  await assert.rejects(call('wm_answer', target.access_token, firstDay.session_id, nextAsk.i, response, submitted), /request_conflict/);

  await setDay(db, '2026-11-06');
  const recovery = await call('wm_today_state', target.access_token);
  assert.equal(recovery.project.goal_passed, true);
  assert.equal(recovery.counts.new, 5);
  assert.ok(recovery.counts.asks + recovery.retry_left <= 30);
  assert.ok(recovery.counts.review + recovery.counts.hard > 0);
  const review = recovery.items.find(item => item.kind === 'ask' && ['review', 'hard'].includes(item.phase));
  const delayedQuestion = (await one('select questions->$2::int as q from public.wm_sessions where id=$1', [recovery.session_id, review.i])).q;
  const delayedAnswer = delayedQuestion.qtype === 'order' ? JSON.stringify(delayedQuestion.correct) : String(delayedQuestion.correct);
  const delayedRequest = randomUUID();
  await call('wm_answer', target.access_token, recovery.session_id, review.i, delayedAnswer, delayedRequest);
  assert.equal((await one('select project_evidence from public.wm_answers where client_id=$1', [delayedRequest])).project_evidence, true);
  // The hosted helper writes last_seen_at, which PostgREST rejects for a STABLE RPC.
  const portalLinksReadOnly = async (token, role = 'anon') => {
    await db.exec(`begin read only; set local role ${role}`);
    try {
      return await call('wm_student_links', token);
    } finally {
      await db.exec('rollback');
    }
  };
  assert.deepEqual(await portalLinksReadOnly(portal), []);
  assert.deepEqual(await portalLinksReadOnly(portal, 'authenticated'), []);
  assert.ok((await call('wm_student_links', portal)).some(row => row.access === target.access_token));
  await applyWmPortalFix(db);
  await applyWmPortalFix(db);
  const portalLinks = await portalLinksReadOnly(portal);
  assert.deepEqual(portalLinks.map(row => row.title), ['Entire saved list']);
  assert.equal(portalLinks[0].access, target.access_token);
  assert.deepEqual(await portalLinksReadOnly(portal, 'authenticated'), portalLinks);
  assert.deepEqual(await portalLinksReadOnly(randomUUID()), []);
  await query("update public.student_sessions set expires_at=now()-interval '1 minute' where token=$1", [portal]);
  assert.deepEqual(await portalLinksReadOnly(portal), []);
  await query("update public.student_sessions set expires_at=now()+interval '1 day' where token=$1", [portal]);
  await query('update public.students set archived_at=now() where id=$1', [student]);
  assert.deepEqual(await portalLinksReadOnly(portal), []);
  await query('update public.students set archived_at=null where id=$1', [student]);
  const overlap = await assign(randomUUID(), 'Same range', cards);
  assert.equal(overlap.plan_id, null);
  assert.deepEqual(overlap.skipped, [student]);

  const small = await assign(randomUUID(), 'Evidence project', cards.slice(0, 4), [studentB]);
  const smallTarget = await one('select id,access_token from public.wm_targets where plan_id=$1', [small.plan_id]);
  await query("update public.wm_words set introduced_day=date '2026-11-04',due_day=date '2026-11-06' where target_id=$1", [smallTarget.id]);
  const evidenceKey = 'word0|뜻0';
  const apply = (style, correct = true, helped = false, retry = false) => call('wm_apply_result', smallTarget.id, evidenceKey, 'meaning', style, correct, helped, retry);
  const state = async () => (await call('wm_open', smallTarget.access_token)).project;
  await apply('copy');
  await apply('meaning', true, true);
  await apply('meaning', true, false, true);
  assert.equal((await state()).verified, 0);
  assert.equal((await one('select stage from public.wm_words where target_id=$1 and key=$2',[smallTarget.id,evidenceKey])).stage, 1);
  await apply('meaning', false);
  assert.equal((await state()).needs_review, 1);
  await setDay(db, '2026-11-07');
  await apply('meaning');
  await apply('reverse');
  assert.equal((await one('select cardinality(unaided_days) as days from public.wm_words where target_id=$1 and key=$2',[smallTarget.id,evidenceKey])).days, 1);
  await setDay(db, '2026-11-09');
  await apply('reverse');
  assert.equal((await state()).verified, 1);
  assert.equal((await state()).completed, false);
  await query('update public.wm_words set stage=3 where target_id=$1', [smallTarget.id]);
  assert.equal((await state()).completed, true);
  const completed = await call('wm_today_state', smallTarget.access_token);
  assert.equal(completed.ended, true);
  assert.equal(completed.project.completed, true);
  assert.equal(completed.day, '2026-11-09');
  assert.deepEqual(completed.items, []);
  assert.equal(completed.counts.asks, 0);

  // A return after a long gap keeps the same daily ceiling even with a large queue.
  await setDay(db, '2026-11-20');
  await query(`update public.wm_words set introduced_day=date '2026-11-01', due_day=date '2026-11-02'
    where target_id=$1 and key in (select key from public.wm_words where target_id=$1 order by key limit 50)`, [target.id]);
  const backlog = await call('wm_today_state', target.access_token);
  assert.equal(backlog.counts.new, 0);
  assert.equal(backlog.counts.asks + backlog.retry_left, 30);
  assert.ok(backlog.project.review_due >= 50);
  assert.equal(backlog.waiting_review, backlog.project.review_due - backlog.counts.review - backlog.counts.hard);
  assert.equal(backlog.project.verified + backlog.project.needs_review + backlog.project.unconfirmed, 3500);


  const customRequest = randomUUID();
  const customCards = cards.slice(0, 140).map(card => ({ ...card, word: 'custom-' + card.word }));
  const assignCustom = (limit, id = customRequest) =>
    call('wm_project_assign_adaptive', id, classId, 'Custom ceiling', customCards, {}, [studentB], 'normal', 14, 7, limit);
  await setDay(db, '2026-12-01');
  await assert.rejects(assignCustom(141), /bad_new_word_limit/);
  const custom = await assignCustom(120);
  assert.equal((await assignCustom(120)).duplicate, true);
  await assert.rejects(assignCustom(119), /request_conflict/);
  await assert.rejects(call('wm_apply_step', custom.plan_id, studentB, 'heavier'), /automatic_pace/);
  const customTarget = await one('select id,access_token from public.wm_targets where plan_id=$1', [custom.plan_id]);
  const customState = () => call('wm_today_state', customTarget.access_token);
  const customFirst = await customState();
  assert.equal(customFirst.counts.new, 120);
  assert.equal((await customState()).session_id, customFirst.session_id);
  const customProgress = await call('wm_plan_progress', custom.plan_id);
  assert.equal(customProgress.initial_new_words, 120);
  assert.equal(customProgress.students[0].today_new_words, 120);

  await setDay(db, '2026-12-02');
  const interrupted = await customState();
  assert.equal(interrupted.counts.new, 60);
  const finishWithRecall = async (session, attempts, correct) => {
    await query('update public.wm_sessions set done_at=now() where id=$1', [session.session_id]);
    await query(`insert into public.wm_answers(session_id, q_index, key, kind, correct, client_id, project_evidence)
      select $1, i, 'test-evidence', 'answer', $3, gen_random_uuid(), true from generate_series(0, $2::int - 1) i`,
      [session.session_id, attempts, correct]);
  };
  await finishWithRecall(interrupted, 4, false);
  await setDay(db, '2026-12-03');
  const lowRecall = await customState();
  assert.equal(lowRecall.counts.new, 30);
  await finishWithRecall(lowRecall, 20, true);
  await setDay(db, '2026-12-04');
  const mixedRecall = await customState();
  assert.equal(mixedRecall.counts.new, 30);
  await finishWithRecall(mixedRecall, 20, true);
  await setDay(db, '2026-12-05');
  const recovered = await customState();
  assert.equal(recovered.counts.new, 38);
  const steps = await call('wm_plan_steps', custom.plan_id);
  assert.equal(steps[0].initial_new_words, 120);
  assert.ok(steps[0].steps.every(step => !['lighter', 'heavier'].includes(step.action)));

  const fullRange = cards.map(card => ({ ...card, word: 'full-' + card.word }));
  const full = await call('wm_project_assign_adaptive', randomUUID(), classId, 'Full ceiling', fullRange,
    {}, [studentB], 'normal', 14, 7, fullRange.length);
  assert.equal((await call('wm_plan_progress', full.plan_id)).initial_new_words, 3500);
  const fullTarget = await one('select access_token from public.wm_targets where plan_id=$1', [full.plan_id]);
  assert.equal((await call('wm_today_state', fullTarget.access_token)).counts.new, 3500);

  await as(db, outsider);
  await assert.rejects(call('wm_plan_progress', project.plan_id), /not_found/);
  await assert.rejects(assign(randomUUID(), 'Outside class', cards.slice(0, 4)), /bad_class/);
  await db.exec('set role anon');
  await assert.rejects(call('wm_project_assign', randomUUID(), classId, 'anon', cards.slice(0, 4), {}, [student], 'normal', 3, 0), /permission denied/);
  await assert.rejects(assignCustom(120, randomUUID()), /permission denied/);
  await assert.rejects(call('wm_project_status', smallTarget.id, '2026-11-08'), /permission denied/);
  console.log('PASS: 3,500 words, approval replay, daily resume, catch-up after target date, independent evidence, completion, adaptive pacing, custom ceilings, access boundaries.');
} finally {
  await db.close();
}

const delivery = await buildFixture();
try {
  await delivery.db.exec(readFileSync(new URL('../../../supabase/103b_word_project_delivery.sql', import.meta.url), 'utf8'));
  await delivery.db.exec(readFileSync(new URL('../../../supabase/103b_word_project_delivery.sql', import.meta.url), 'utf8'));
  const pool = [{ key: 'bank|은행', word: 'bank', meaning: '은행' }, { key: 'unused|미사용', word: 'unused', meaning: '미사용' }];
  await delivery.db.query('update public.wm_plans set cards=$1 where id=$2', [JSON.stringify(pool), delivery.WL]);
  const getSnapshot = async (runId) => (await delivery.one('select s.definition from public.learning_sensor_snapshots s join public.learning_delivery_runs r on r.snapshot_id=s.id where r.id=$1', [runId])).definition;
  const getAccess = await delivery.one('select access_token from public.wm_targets where id=$1', [delivery.WT]);
  const legacy = await delivery.call('learning_run_open', 'word_memory', getAccess.access_token, null);
  assert.equal((await getSnapshot(legacy.sensor_run_id)).grading.cards.length, 2);
  await delivery.db.query("update public.wm_plans set rule_version='wm-v2' where id=$1", [delivery.WL]);
  const project = await delivery.call('learning_run_open', 'word_memory', getAccess.access_token, null);
  const frozen = await getSnapshot(project.sensor_run_id);
  assert.equal(frozen.grading.rule_version, 'wm-v2');
  assert.deepEqual(frozen.grading.cards.map(card => card.key), ['bank|은행']);
  const resumed = await delivery.call('learning_run_open', 'word_memory', getAccess.access_token, null);
  assert.deepEqual(await getSnapshot(resumed.sensor_run_id), frozen);
  console.log('PASS: learning sensor receipts preserve the project rule and only the delivered cards.');
} finally {
  await delivery.db.close();
}
