import assert from 'node:assert/strict';
import { buildFixture } from './learning-fixture.mjs';

const f = await buildFixture();
try {
  await f.db.exec(`create schema auth; create function auth.uid() returns uuid language sql as $$select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid$$`);
  await f.db.exec(f.read('099_learning_paths.sql'));
  await f.db.exec(f.read('100_learning_research.sql'));
  await f.db.exec(f.read('100_learning_research.sql'));
  await f.db.exec('set role anon');
  await assert.rejects(()=>f.call('admin_learning_research',30,null), /permission denied/);
  await f.db.exec(`reset role;set role authenticated;select set_config('test.admin','no',false)`);
  for (const [name,args] of [
    ['admin_learning_research',[30,null]],['admin_learning_research_decisions',[30,null]],
    ['admin_learning_research_decide',[crypto.randomUUID(),30,null,'practice','compare','','fake']],
  ]) await assert.rejects(()=>f.call(name,...args), /forbidden/);
  await assert.rejects(()=>f.db.query('select * from learning_research_decisions'), /permission denied/);
  await f.db.exec(`select set_config('test.admin','yes',false),set_config('test.staff','yes',false),set_config('test.academy','${f.A}',false)`);
  const empty = await f.call('admin_learning_research',30,null);
  assert.equal(empty.overview.assignments,0); assert.deepEqual(empty.cohorts,[]);
  assert.deepEqual(empty.rounds.map(r=>[r.due,r.answered,r.correct,r.missing]),[[0,0,0,0],[0,0,0,0]]);
  await assert.rejects(()=>f.call('admin_learning_research',null,null),/bad_range/);
  await assert.rejects(()=>f.call('admin_learning_research',999,null),/bad_range/);
  await assert.rejects(()=>f.call('admin_learning_research',30,crypto.randomUUID()),/bad_academy/);

  async function assign(cards,practice='letters',classId=f.HW,student=f.ST) {
    const p=await f.call('learning_path_assign',crypto.randomUUID(),classId,[student],'Research fixture',JSON.stringify(cards),practice);
    await f.db.exec('reset role');
    const id=(await f.one('select id from solo_assignments where lesson_id=$1',[p.lesson_id])).id;
    await f.db.exec('set role authenticated');
    return id;
  }
  const a=await assign([{word:'cat',meaning:'고양이'},{word:'dog',meaning:'개'}]);
  const firstOpen=await f.call('learning_path_open',f.TK,a);
  const event=()=>({id:crypto.randomUUID(),session:crypto.randomUUID(),position:3,question:null,action:'shown',at:new Date().toISOString(),visible_ms:1000,input_recent_ms:0});
  assert.equal((await f.call('learning_sensor_report_run',firstOpen.run_id,f.TK,JSON.stringify([event()]))).accepted,1);
  const act=(pos,action,value=null)=>f.call('learning_path_action',f.TK,a,crypto.randomUUID(),pos,action,value);
  await act(1,'unknown'); await act(2,'continue');
  const reopened=await f.call('learning_path_open',f.TK,a);
  assert.notEqual(firstOpen.run_id,reopened.run_id,'returning to a lesson creates a distinct delivery run');
  assert.equal((await f.call('learning_sensor_report_run',reopened.run_id,f.TK,JSON.stringify([event()]))).accepted,1);
  await act(3,'hint'); await act(3,'answer','cat');
  await act(4,'answer','wrong'); // first initial check fails; bounded relearning follows
  await act(2,'continue'); await act(3,'answer','cat'); await act(4,'answer','cat');
  await act(5,'answer','dog'); await act(8,'answer','dog');
  await f.db.exec('reset role');
  await f.db.query("update learning_path_states set first_completed_at=now()-interval '10 days',due_at=now()-interval '9 days' where assignment_id=$1",[a]);
  await f.db.query("update learning_path_checks set checked_at=now()-interval '10 days' where assignment_id=$1 and round=0",[a]);
  await f.db.exec('set role authenticated');
  await act(4,'answer','cat'); // word dog remains due and unanswered
  const notOpened=await assign([{word:'bird',meaning:'새'}],'recall');
  await f.db.exec(`select set_config('test.academy','${f.B}',false)`);
  await assign([{word:'fish',meaning:'물고기'}],'recall',f.IT,f.OTHER);
  const all=await f.call('admin_learning_research',30,null);
  const r=await f.call('admin_learning_research',30,f.A);
  assert.equal(all.overview.assignments,3); assert.equal(r.overview.assignments,2);
  assert.equal(r.overview.students,1); assert.equal(r.overview.started,1); assert.equal(r.overview.first_completed,1);
  assert.equal(r.quality.observed_runs,1,'multiple runs count as one observed assignment');
  assert.equal(r.quality.visible_ms,2000,'telemetry from both runs is retained');
  const needs=r.cohorts.find(c=>c.baseline==='needs_practice');
  assert.equal(needs.first_checked,1);assert.equal(needs.first_correct,0);assert.equal(needs.final_correct,1);
  assert.equal(needs.practice_answers,2,'both bounded practice attempts counted');
  assert.equal(r.cohorts.find(c=>c.baseline==='unknown').goal_units,1,'unopened is unknown, not incorrect');
  assert.deepEqual(r.rounds.map(x=>[x.due,x.answered,x.correct,x.missing,x.not_due,x.not_scheduled]),[[2,1,1,1,0,1],[0,0,0,0,0,3]]);
  assert.ok(Number(r.rounds[0].min_elapsed_days)>=9.99,'actual delay uses recorded timestamps');
  assert.equal(r.quality.unlinked_answers,0);assert.equal(r.quality.mismatched_answers,0);
  assert.equal(r.content_versions.length,2,'different diagnostic groups remain separate inside a delivered version');
  assert.ok(r.content_versions.every(v=>v.title==='Research fixture' && v.fingerprint));
  assert.equal(r.versions_truncated,false);
  assert.equal((await f.call('admin_learning_research',30,f.A)).evidence_hash,r.evidence_hash,'unchanged aggregate hash is stable');
  assert.doesNotMatch(JSON.stringify(r),/학생 A|학생 B|aaaaaaaa-aaaa|"student_id"|"p_token"/,'report has no learner identity or token');
  const request=crypto.randomUUID();
  const args=[request,30,f.A,'practice','compare','첫 확인과 재학습을 구분해 검증',r.evidence_hash];
  assert.equal((await f.call('admin_learning_research_decide',...args)).duplicate,false);
  assert.equal((await f.call('admin_learning_research_decide',...args)).duplicate,true);
  await assert.rejects(()=>f.call('admin_learning_research_decide',request,30,f.A,'practice','hold','',r.evidence_hash),/request_changed/);
  const history=await f.call('admin_learning_research_decisions',30,f.A);
  assert.equal(history.length,1); assert.equal(history[0].evidence.evidence_hash,r.evidence_hash);
  assert.equal((await f.call('admin_learning_research_decisions',7,f.A)).length,0);
  assert.equal((await f.call('admin_learning_research_decisions',30,null)).length,0,'scope history is exact, not mixed');

  // Late round-1 completion schedules round 2 for at least the next day.
  await act(8,'answer','dog');
  const scheduled=await f.call('admin_learning_research',30,f.A);
  assert.deepEqual(scheduled.rounds.map(x=>[x.due,x.answered,x.missing,x.not_due,x.not_scheduled]),[[2,2,0,0,1],[0,0,0,2,1]]);
  await f.db.exec('reset role');
  await f.db.query("update learning_path_states set due_at=now()-interval '1 hour' where assignment_id=$1",[a]);
  await f.db.exec('set role authenticated');
  const overdue=await f.call('admin_learning_research',30,f.A);
  assert.deepEqual([overdue.rounds[1].due,overdue.rounds[1].answered,overdue.rounds[1].missing],[2,0,2]);
  await act(4,'answer','cat');
  const partial=await f.call('admin_learning_research',30,f.A);
  assert.deepEqual([partial.rounds[1].due,partial.rounds[1].answered,partial.rounds[1].correct,partial.rounds[1].missing],[2,1,1,1]);
  assert.equal((await f.call('admin_learning_research_decisions',30,f.A))[0].evidence.rounds[0].missing,1,'saved evidence is frozen');
  await f.call('learning_path_open',f.TK,notOpened); // changes reviewed evidence
  await assert.rejects(()=>f.call('admin_learning_research_decide',crypto.randomUUID(),30,f.A,'practice','compare','',r.evidence_hash),/research_changed_refresh/);
  assert.equal((await f.call('admin_learning_research_decide',...args)).duplicate,true,'retry remains idempotent even after new learning data');
  await f.db.exec('reset role');
  assert.equal((await f.one('select count(*)::int n from learning_research_decisions')).n,1);
  await f.db.query("update learning_path_plans set created_at=now()-interval '40 days' where lesson_id=(select lesson_id from solo_assignments where id=$1)",[notOpened]);
  await f.db.exec('set role authenticated');
  assert.equal((await f.call('admin_learning_research',30,f.A)).overview.assignments,1);
  assert.equal((await f.call('admin_learning_research',90,f.A)).overview.assignments,2);
  // A cross-assignment link or a mismatched version must be exposed as bad evidence.
  await f.db.exec('reset role'); await f.db.exec('begin');
  await f.db.query("update learning_evidence_links set run_id=(select run_id from learning_path_states where assignment_id=$2) where evidence_id=(select min(id) from solo_step_events where assignment_id=$1 and kind='answer') and source_table='solo_step_events'",[a,notOpened]);
  await f.db.exec('set role authenticated');
  assert.equal((await f.call('admin_learning_research',90,f.A)).quality.unlinked_answers,1);
  await f.db.exec('rollback'); await f.db.exec('reset role'); await f.db.exec('begin');
  await f.db.query("update learning_evidence_links set version_matches=false where evidence_id=(select min(id) from solo_step_events where assignment_id=$1 and kind='answer') and source_table='solo_step_events'",[a]);
  await f.db.exec('set role authenticated');
  assert.equal((await f.call('admin_learning_research',90,f.A)).quality.mismatched_answers,1);
  await f.db.exec('rollback');
  await f.db.exec('reset role');
  await f.db.exec('begin');
  await f.db.query("update learning_evidence_links set version_matches=false where evidence_id=(select min(id) from solo_step_events where assignment_id=$1 and step_index=4 and kind='answer') and source_table='solo_step_events'",[a]);
  await f.db.exec('set role authenticated');
  const brokenFirst=await f.call('admin_learning_research',90,f.A);
  const needsFirst=brokenFirst.cohorts.find(c=>c.baseline==='needs_practice');
  assert.equal(needsFirst.first_checked,0,'bad first-check evidence stays unknown rather than promoting a later correct attempt');
  assert.equal(needsFirst.final_correct,1,'final result is still reported separately');
  await f.db.exec('rollback'); await f.db.exec('reset role');
  const check=(await f.db.query(f.read('100_check.sql'))).rows[0];assert.ok(Object.values(check).every(x=>x===true),JSON.stringify(check));
  await f.db.exec(f.read('100_rollback.sql'));
  await f.db.exec('set role authenticated');await assert.rejects(()=>f.call('admin_learning_research',30,null),/permission denied/);
  await f.db.exec('reset role');assert.equal((await f.one('select count(*)::int n from learning_research_decisions')).n,1,'stop preserves evidence');
  await f.db.exec(f.read('100_learning_research.sql'));
  await f.db.exec('set role authenticated');assert.equal((await f.call('admin_learning_research_decisions',30,f.A)).length,1);
  console.log('Research DB: admin-only RPC/RLS, cohort windows/scopes, first versus final checks, delayed due/answer/missing denominators, unknown baseline, observed delays, private aggregates, reviewed-evidence hash, idempotent decisions, history and data-preserving stop/reapply passed.');
} finally { await f.db.close(); }
