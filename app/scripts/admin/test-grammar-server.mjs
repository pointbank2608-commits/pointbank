import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const repo = process.env.CLASSBANK_TEST_ROOT
  ? pathToFileURL(resolve(process.env.CLASSBANK_TEST_ROOT) + '/')
  : new URL('../../../', import.meta.url);
const migration = process.env.CLASSBANK_GRAMMAR_SQL
  ? pathToFileURL(resolve(process.env.CLASSBANK_GRAMMAR_SQL) + '/')
  : new URL('supabase/', repo);
const fixtureModule = new URL('app/scripts/admin/adaptive-homework-fixture.mjs', repo);
const { buildAdaptiveFixture } = await import(fixtureModule);
const { Client } = createRequire(fixtureModule)('pg');
const target = new URL(process.env.PG_ADMIN_URL);
assert.ok(process.env.LEARNING_TEST_DISPOSABLE === 'yes' && target.hostname === '127.0.0.1');

const connections = [];
async function connect(url) {
  const client = new Client({ connectionString: url.href, connectionTimeoutMillis: 5000,
    statement_timeout: 12000, lock_timeout: 8000 });
  await client.connect();
  connections.push(client);
  return client;
}
async function call(client, fn, ...args) {
  const { rows } = await client.query(`select public.${fn}(${args.map((_, i) => '$' + (i+1)).join(',')}) as result`, args);
  return rows[0].result;
}
const expectError = async (run, code) => assert.rejects(run, { message: code });
const fanout = async (clients, run) => {
  let start;
  const gate = new Promise(resolve => { start = resolve; });
  const tasks = clients.map(async (c, i) => { await gate; return run(c, i); });
  start();
  return Promise.allSettled(tasks);
};
const syntax = ['102_grammar_learning.sql','102b_grammar_pilot_content.sql','102c_grammar_results.sql'];
const database = 'grammar_test_' + randomUUID().replaceAll('-', '');
const admin = await connect(target);
try {
  await admin.query(`create database ${database}`);
  const scratch = new URL(target);
  scratch.pathname = '/' + database;
  const owner = await connect(scratch);
  await admin.query(`do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;`);
  const f = await buildAdaptiveFixture({
    exec: sql => owner.query(sql.replace(/create role anon;\s*create role authenticated;/, '')),
    query: (sql, args) => owner.query(sql, args),
  });
  for (const name of [...syntax, ...syntax]) {
    await owner.query(readFileSync(new URL(name, migration), 'utf8'));
  }
  assert.deepEqual(await call(owner,'learning_path_compat_problems'), []);
  const staff = await connect(scratch);
  const outsider = await connect(scratch);
  const students = await Promise.all(Array.from({ length: 8 }, () => connect(scratch)));
  const [student, other] = students;
  await staff.query("set role authenticated; set test.staff='yes'");
  await staff.query("select set_config('test.academy',$1,false)",[f.A]);
  await outsider.query("set role authenticated; set test.staff='no'");
  for (const c of students) await c.query('set role anon');
  const catalog = await call(staff,'grammar_catalog');
  assert.equal(catalog.length,3);
  await expectError(call(outsider,'grammar_catalog'),'forbidden');
  await expectError(call(staff,'admin_grammar_summary',30),'forbidden');
  await assert.rejects(call(student,'grammar_teacher_summary',f.HW,'homework'),{code:'42501'});
  await expectError(call(staff,'grammar_teacher_summary',f.IT,'homework'),'not_found');
  await assert.rejects(call(student,'grammar_preview',catalog[0].goalId,2), { code:'42501' });
  await assert.rejects(student.query('select content from public.grammar_content_versions'), { code:'42501' });
  await assert.rejects(call(student,'grammar_state',randomUUID()), { code:'42501' });
  assert.deepEqual(await call(student,'grammar_student_list',f.TK),[]);

  const unit = catalog.find(x => x.goalId==='past-question-base-verb');
  const content = await call(staff,'grammar_preview',unit.goalId,unit.version);
  const request = randomUUID();
  const planArgs = [request,f.HW,[f.ST],'homework',unit.goalId,unit.version,null];
  const plan = await call(staff,'grammar_assign',...planArgs);
  assert.deepEqual(await call(staff,'grammar_assign',...planArgs),{...plan,duplicate:true});
  await expectError(call(staff,'grammar_assign',...planArgs.slice(0,3),'individual',...planArgs.slice(4)),'request_changed');
  await expectError(call(staff,'grammar_assign',randomUUID(),f.HW,[f.ST,f.OTHER],'homework',unit.goalId,2,null),'bad_student');
  await expectError(call(staff,'grammar_assign',randomUUID(),f.IT,[f.OTHER],'individual',unit.goalId,2,null),'bad_class');
  const [entry] = await call(student,'grammar_student_list',f.TK);
  const id = entry.assignmentId;
  assert.equal(entry.status,'assigned');
  assert.equal(entry.mode,'homework');
  assert.deepEqual(await call(other,'grammar_student_list',f.otherToken),[]);
  await expectError(call(other,'grammar_open',f.otherToken,id),'not_found');
  await expectError(call(student,'grammar_open',randomUUID(),id),'expired');
  await owner.query('update students set academy_id=$1,class_id=$2 where id=$3',[f.A,f.HW,f.OTHER]);
  await expectError(call(other,'grammar_open',f.otherToken,id),'not_found');

  const opened = await fanout(students,c => call(c,'grammar_open',f.TK,id));
  assert.ok(opened.every(result => result.status==='fulfilled'), JSON.stringify(opened));
  assert.equal(new Set(opened.map(result => result.value.runId)).size,1);
  const run = opened[0].value.runId;
  assert.equal(opened[0].value.state.step.phase,'explain');
  const count = async (table, field, value) => Number((await owner.query(
    `select count(*) from public.${table} where ${field}=$1`,[value])).rows[0].count);
  assert.equal(await count('learning_delivery_runs','resource_id',id),1);
  const action = (c, revision, verb, item=null, option=null, req=randomUUID(), token=f.TK) =>
    call(c,'grammar_act',token,id,req,revision,verb,item,option);
  await expectError(action(other,0,'continue',null,null,randomUUID(),f.otherToken),'not_found');
  await expectError(call(student,'learning_run_action',run,f.TK,0,'reveal','{}'),'use_grammar_flow');
  await expectError(call(other,'learning_sensor_report_run',run,f.otherToken,'[]'),'not_found');
  const event = position => JSON.stringify([{id:randomUUID(),session:randomUUID(),position,
    action:'shown',at:new Date().toISOString(),visible_ms:0,input_recent_ms:0}]);
  assert.equal((await call(student,'learning_sensor_report_run',run,f.TK,event(0))).accepted,1);
  await expectError(call(student,'learning_sensor_report_run',run,f.TK,event(5)),'bad_sensor_position');

  const reason = await action(student,0,'continue');
  const reasonItem = reason.state.step.item;
  assert.equal(reasonItem.id,content.reasoning.id);
  assert.equal(reasonItem.correctOptionId,undefined);
  assert.ok(reasonItem.options.every(o => Object.keys(o).length===2));
  assert.deepEqual((await call(student,'grammar_open',f.TK,id)).state.step.item.options,reasonItem.options);
  assert.equal(JSON.stringify(reason).includes(content.delayed.sentence),false);
  const wrong = content.reasoning.options.find(o => o.id!==content.reasoning.correctOptionId).id;
  await expectError(action(student,1,'answer',reasonItem.id,'forged'),'bad_answer');
  await expectError(action(student,1,'answer',content.delayed.id,content.delayed.correctOptionId),'bad_answer');
  const sameRequest = randomUUID();
  const answers = await fanout(students,c => action(c,1,'answer',reasonItem.id,wrong,sameRequest));
  assert.ok(answers.every(result => result.status==='fulfilled'), JSON.stringify(answers));
  assert.equal(answers.filter(result => !result.value.duplicate).length,1);
  assert.equal(await count('grammar_answers','assignment_id',id),1);
  assert.equal((await call(student,'grammar_open',f.TK,id)).state.feedback.correct,false);
  await expectError(action(student,1,'answer',reasonItem.id,content.reasoning.correctOptionId,sameRequest),'request_changed');

  assert.equal((await action(student,2,'continue')).state.step.phase,'repair');
  const replay = await action(student,1,'answer',reasonItem.id,wrong,sameRequest);
  assert.equal(replay.state.step.phase,'repair');
  assert.equal(replay.appliedRevision,2);
  const practice = await action(student,3,'continue');
  assert.equal(practice.state.step.phase,'practice');
  const p = content.repair.practice;
  await owner.query(`create function fixture_fail_grammar_write() returns trigger language plpgsql as
    $$begin raise exception 'fixture_write_failed'; end$$;
    create trigger fixture_fail_grammar_write before insert on grammar_action_requests
    for each row execute function fixture_fail_grammar_write()`);
  await expectError(action(student,4,'answer',p.id,p.correctOptionId),'fixture_write_failed');
  assert.equal(await count('grammar_answers','assignment_id',id),1);
  assert.equal((await call(student,'grammar_open',f.TK,id)).revision,4);
  await owner.query('drop trigger fixture_fail_grammar_write on grammar_action_requests');
  const competing = await fanout(students,c => action(c,4,'answer',p.id,p.correctOptionId));
  assert.equal(competing.filter(result => result.status==='fulfilled').length,1);
  assert.ok(competing.filter(result => result.status==='rejected').every(result => result.reason.message==='grammar_changed'));
  assert.equal(await count('grammar_answers','assignment_id',id),2);
  const resumeRace = await fanout(students,(c,i) => i===0 ? action(c,5,'continue') : call(c,'grammar_open',f.TK,id));
  assert.ok(resumeRace.every(result => result.status==='fulfilled'), JSON.stringify(resumeRace));
  const transfer = resumeRace[0].value;
  assert.equal(transfer.state.step.phase,'transfer');
  const initial = await action(student,6,'answer',content.transfer.id,content.transfer.correctOptionId);
  assert.equal(Date.parse(initial.reviewDueAt)-Date.parse(initial.initialCompletedAt),86400000);
  const wait = await action(student,7,'continue');
  assert.equal(wait.state.kind,'waiting');
  assert.equal(JSON.stringify(wait).includes(content.delayed.sentence),false);
  await expectError(action(student,8,'answer',content.delayed.id,content.delayed.correctOptionId),'not_due');
  await expectError(call(student,'learning_sensor_report_run',run,f.TK,event(5)),'bad_sensor_position');
  const teacherRows = () => call(staff,'grammar_teacher_summary',f.HW,'homework');
  assert.deepEqual((await teacherRows()).map(r => [r.reasoning,r.practice,r.transfer,r.review]), [[false,true,true,'waiting']]);
  await outsider.query("set test.admin='yes'");
  const adminRows = () => call(outsider,'admin_grammar_summary',30);
  assert.equal((await adminRows())[0].reviewWaiting,1);

  await owner.query("update grammar_assignments set review_due_at=now()-interval '1 minute' where id=$1",[id]);
  assert.equal((await teacherRows())[0].review,'missing');
  assert.equal((await adminRows())[0].reviewMissing,1);
  const delayed = await call(student,'grammar_open',f.TK,id);
  assert.equal(delayed.state.step.item.sentence,content.delayed.sentence);
  assert.equal(JSON.stringify(delayed).includes('correctOptionId'),false);
  assert.equal((await call(student,'learning_sensor_report_run',run,f.TK,event(5))).accepted,1);
  await action(student,8,'answer',content.delayed.id,content.delayed.correctOptionId);
  assert.equal((await action(student,9,'continue')).state.kind,'finished');
  assert.equal(await count('grammar_answers','assignment_id',id),4);
  assert.equal((await teacherRows())[0].review,'correct');
  assert.equal((await adminRows())[0].reviewCorrect,1);
  await owner.query("update academies set features='{\"solo\":true,\"homework\":false}' where id=$1",[f.A]);
  assert.deepEqual(await call(student,'grammar_student_list',f.TK),[]);
  await expectError(call(student,'grammar_open',f.TK,id),'feature_closed');
  await expectError(call(student,'learning_sensor_report_run',run,f.TK,event(5)),'feature_closed');

  const solo = await call(staff,'grammar_assign',randomUUID(),f.HW,[f.ST],'individual',unit.goalId,2,null);
  const [soloEntry] = await call(student,'grammar_student_list',f.TK);
  assert.equal(soloEntry.mode,'individual');
  assert.equal((await call(student,'grammar_open',f.TK,soloEntry.assignmentId)).state.step.phase,'explain');
  assert.ok(solo.planId);
  const soloAction = (revision,verb,item=null,option=null) =>
    call(student,'grammar_act',f.TK,soloEntry.assignmentId,randomUUID(),revision,verb,item,option);
  await soloAction(0,'continue');
  await soloAction(1,'answer',content.reasoning.id,content.reasoning.correctOptionId);
  assert.equal((await soloAction(2,'continue')).state.step.phase,'transfer');
  await owner.query('update grammar_content_versions set retired_at=now() where goal_id=$1',[unit.goalId]);
  await expectError(call(staff,'grammar_preview',unit.goalId,2),'not_found');
  await expectError(call(staff,'grammar_assign',randomUUID(),f.HW,[f.ST],'individual',unit.goalId,2,null),'content_unavailable');
  assert.equal((await call(student,'grammar_open',f.TK,soloEntry.assignmentId)).state.step.phase,'transfer');
  await owner.query('update grammar_assignments set revoked_at=now() where id=$1',[soloEntry.assignmentId]);
  await expectError(call(student,'grammar_open',f.TK,soloEntry.assignmentId),'not_found');
  const prior = await call(student,'learning_run_open','solo',f.TK,f.SA);
  assert.ok(prior.sensor_run_id);
  await expectError(owner.query("update grammar_content_versions set content=content||'{\"title\":\"Changed\"}'"),'grammar_version_immutable');
  console.log('PASS: PostgreSQL 8 connections; permissions, duplicate and competing submissions, version, state, delayed gate, sensors, legacy run.');
} finally {
  for (const c of connections.slice(1).reverse()) await c.end();
  try { await admin.query(`drop database if exists ${database} with (force)`); }
  finally { await admin.end(); }
}
