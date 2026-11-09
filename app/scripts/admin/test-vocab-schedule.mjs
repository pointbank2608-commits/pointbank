import assert from 'node:assert/strict';
import { buildAdaptiveFixture } from './adaptive-homework-fixture.mjs';

const f = await buildAdaptiveFixture();
const cards = [{word:'cat',meaning:'고양이'}, {word:'dog',meaning:'개'}];
const essential = [{...cards[1],mode:'spell'}];
const teacher = (academy = f.A) => f.db.exec(`reset role; set role authenticated;
  select set_config('test.staff','yes',false),set_config('test.academy','${academy}',false)`);
const student = () => f.db.exec('reset role; set role anon');
const plus = (day,n) => new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const dow = day => new Date(day+'T00:00:00Z').getUTCDay() || 7;
const localDay = stamp => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(stamp));
const approve = (id,timetable,options={}) => f.call('learning_vocab_cue_approve_scheduled',id,f.HW,[f.ST],
  '다음 수업 준비',JSON.stringify(options.cards??cards),options.modes??['spell','listen','read'],true,
  options.draft??null,null,options.contexts?JSON.stringify(options.contexts):null,false,JSON.stringify(timetable));
const assignmentOf = async lesson => (await f.one('select id from solo_assignments where lesson_id=$1',[lesson])).id;
const read = () => f.call('learning_vocab_schedule_read',f.HW);
const save = (rev,classes,reviews) => f.call('learning_vocab_schedule_save',f.HW,rev,classes,reviews);
const open = id => f.call('learning_vocab_cue_open',f.TK,id);

try {
  await f.db.exec('alter table word_bank add column example_sentence text');
  await f.db.exec(f.read('115_vocab_learning_loop.sql'));
  await f.db.exec(f.read('116_vocab_cues.sql'));
  assert.ok(Object.values((await f.db.query(f.read('116_check.sql'))).rows[0]).every(Boolean));
  await student();
  await assert.rejects(read,/permission denied/);
  await teacher(f.B);
  await assert.rejects(read,/bad_class/);
  await teacher();
  const {today} = await read();
  const futureReview = plus(today,2);
  const chosenDays = [dow(futureReview),dow(plus(today,4))].sort();
  const schedule = await save(0,[1,3],chosenDays);
  assert.deepEqual(schedule.class_days,[1,3]);
  assert.equal(schedule.next_review_on,futureReview);
  await assert.rejects(()=>save(0,[2,4],[]),/schedule_changed/);
  await assert.rejects(()=>save(1,[8],[]),/bad_schedule_days/);
  await assert.rejects(()=>f.db.query('select * from learning_vocab_class_schedules'),/permission denied/);

  const request = crypto.randomUUID();
  const timetable = {revision:1,next_class_on:plus(today,1),opens_on:null,essential};
  const initial = await approve(request,timetable);
  const feedback = async () => f.call('learning_vocab_cue_feedback',f.HW,initial.lesson_id);
  const savedPlan = (await feedback()).timetable;
  assert.equal(localDay(savedPlan.focus_due_at),plus(today,1));
  assert.deepEqual(savedPlan.review_days,chosenDays);
  await assert.rejects(()=>approve(crypto.randomUUID(),{...timetable,essential:[{...cards[1],mode:'other'}]}),/bad_essential_goal/);
  const changed = await save(1,[2,4],[]);
  assert.equal(changed.revision,2);
  assert.equal((await approve(request,timetable)).duplicate,true,'approval replay retains the reviewed schedule');
  await assert.rejects(()=>approve(crypto.randomUUID(),timetable),/schedule_changed/);
  assert.deepEqual((await feedback()).timetable,savedPlan);

  await f.db.exec('reset role');
  const assignment = await assignmentOf(initial.lesson_id);
  await student();
  let state = await open(assignment);
  assert.equal(state.item.essential,true);
  assert.equal(state.item.word_index,1);
  const act = async (action,value=null,id=assignment) => {
    const reply = await f.call('learning_vocab_cue_action',f.TK,id,crypto.randomUUID(),state.revision,action,value);
    state=reply.state;
    return reply;
  };
  const correct = () => act('answer',cards[state.item.word_index][state.item.mode==='spell'?'word':'meaning']);
  await act('answer','dag');
  while(state.phase==='diagnostic') {
    if (state.item.word_index===0&&state.item.mode==='read') await correct();
    else if (state.item.word_index===1&&state.item.mode==='listen') await act('answer','고양이');
    else await act('unknown');
  }
  assert.equal(state.item.essential,true);
  assert.deepEqual(state.item.support,{kind:'spell_compare',attempt:'dag'});
  assert.deepEqual((await act('continue')).support,{kind:'spell_compare',attempt:'dag'});
  await act('unknown');
  let comparedSounds=false;
  while(state.phase==='learn') {
    if (state.item.word_index===1&&state.item.mode==='listen') {
      assert.deepEqual(state.item.support,{kind:'listen_contrast',word:'cat',meaning:'고양이'});
      comparedSounds=true;
    }
    await act('continue'); await correct();
  }
  assert.equal(comparedSounds,true);
  while(state.phase==='check') {
    if (state.item.essential) await act('unknown');
    else await correct();
  }
  assert.deepEqual([state.gap_count,state.verified_count],[5,4]);
  assert.equal(state.phase,'learn','the unresolved essential goal gets another explanation at 80%');
  assert.equal(state.item.support.kind,'spell_chunks');
  await act('continue');
  await correct();
  await act('unknown');
  assert.equal(state.phase,'learn','a supported success allows a third essential round');
  await act('continue');
  await correct();
  await act('unknown');
  assert.equal(state.waiting,true);
  assert.equal(localDay(state.due_at),futureReview,'approval uses the frozen review days in Korea');
  await assert.rejects(()=>act('unknown'),/not_due/);

  await teacher();
  const row=()=>feedback().then(result=>result.cue_rows.find(entry=>entry.card.word==='dog'));
  assert.deepEqual([(await row()).cues.spell.essential,(await row()).cues.spell.before_deadline,(await row()).cues.spell.latest],[true,false,false]);
  const draft=await f.call('learning_vocab_cue_draft',initial.lesson_id,'lesson',f.ST);
  assert.deepEqual(draft.cue.essential,essential);
  const home=await f.call('learning_vocab_cue_draft',initial.lesson_id,'homework',f.ST);
  const later=await approve(home.id,{revision:2,next_class_on:null,opens_on:futureReview,essential:[]},{
    cards:[cards[1]],modes:[],draft:home.id,contexts:[{...cards[1],sentence:'The dog waits by the gate.'}],
  });
  await f.db.exec('reset role');
  const homework=await assignmentOf(later.lesson_id);
  await student();
  const portal=await f.call('student_home_with_vocab_schedule',f.TK);
  const future=portal.lessons.find(item=>item.id===homework);
  assert.equal(future.path_waiting,true,'future homework shows its start before opening');
  assert.equal(localDay(future.path_starts_at),futureReview);
  state=await open(homework);
  assert.equal(state.item,null,'new sentence stays private before the scheduled date');
  await assert.rejects(()=>act('unknown',null,homework),/not_due/);
  await f.db.exec('reset role');
  await f.db.query("update learning_path_states set due_at=now()-interval '1 hour' where assignment_id=$1",[assignment]);
  await student();
  state=await open(assignment);
  while(!state.waiting&&!state.finished) await correct();
  await f.db.exec('reset role');
  await f.db.query(`update learning_vocab_cue_actions set recorded_at=$2::timestamptz+interval '1 hour'
    where assignment_id=$1 and phase='review'`,[assignment,savedPlan.focus_due_at]);
  await teacher();
  assert.deepEqual([(await row()).cues.spell.before_deadline,(await row()).cues.spell.latest],[false,true],
    'a late correct answer never backfills the deadline');
  const noReview=await approve(crypto.randomUUID(),{revision:2,next_class_on:null,opens_on:null,essential:[]},
    {cards:[cards[0]],modes:['spell']});
  await f.db.exec('reset role');
  const one=await assignmentOf(noReview.lesson_id);
  await student();
  state=await open(one);
  await act('answer','cat',one);
  assert.equal(state.finished,true,'an explicitly empty review week schedules no automatic reviews');
  console.log('Vocabulary timetable DB passed: class scope, Korea dates, frozen approvals, essential retries, late evidence and scheduled portal opening.');
} catch(error) {
  console.error(error.message,error.detail??'',error.where??'');
  process.exitCode=1;
} finally { await f.db.close(); }
