import assert from 'node:assert/strict';
import { buildAdaptiveFixture } from './adaptive-homework-fixture.mjs';

const f = await buildAdaptiveFixture();
const silent = crypto.randomUUID();
const cards = [
  { word: 'cat', meaning: '고양이', example: 'A cat can jump.' },
  { word: 'dog', meaning: '개', example: 'A dog can run fast.' },
];
const teacher = (academy = f.A) => f.db.exec(`reset role; set role authenticated;
  select set_config('test.staff','yes',false),set_config('test.academy','${academy}',false)`);
const student = () => f.db.exec('reset role; set role anon');
const feedback = async lesson => (await f.call('learning_vocab_cue_feedback', f.HW, lesson)).cue_rows;
const approve = ({ id, content = cards, modes = ['read', 'listen', 'spell'], draft = null,
  contexts = null, contextual = false, students = [f.ST, silent] }) =>
  f.call('learning_vocab_cue_approve', id, f.HW, students, '어휘 확인', JSON.stringify(content), modes, !contexts,
    draft, null, contexts && JSON.stringify(contexts), contextual);
const open = id => f.call('learning_vocab_cue_open', f.TK, id);
const answer = (id, revision, action, value = null, request = crypto.randomUUID()) =>
  f.call('learning_vocab_cue_action', f.TK, id, request, revision, action, value);
const idFor = async lesson => (await f.one('select id from solo_assignments where lesson_id=$1 and student_id=$2', [lesson, f.ST])).id;
const unlock = async assignment => {
  await f.db.exec('reset role');
  await f.db.query("update learning_path_states set due_at=now()-interval '1 hour' where assignment_id=$1", [assignment]);
  await student();
  return open(assignment);
};

try {
  await f.db.exec('alter table word_bank add column example_sentence text');
  await f.db.query("insert into word_bank values ('dog','개','noun',1,'The dog sleeps beside my chair.')");
  await f.db.query("insert into students(id,academy_id,class_id,name) values($1,$2,$3,'미응답 학생')", [silent, f.A, f.HW]);
  await f.db.exec(f.read('115_vocab_learning_loop.sql'));
  await f.db.exec(f.read('116_vocab_cues.sql'));
  await f.db.exec(f.read('116_vocab_cues.sql'));
  assert.ok(Object.values((await f.db.query(f.read('115_check.sql'))).rows[0]).every(Boolean));
  assert.ok(Object.values((await f.db.query(f.read('116_check.sql'))).rows[0]).every(Boolean));
  await teacher();
  const id = crypto.randomUUID();
  const lesson = (await approve({ id })).lesson_id;
  assert.equal((await approve({ id })).duplicate, true);
  await assert.rejects(() => approve({ id, modes: ['spell'] }), /request_changed/);
  assert.equal(await f.call('learning_vocab_cue_draft', lesson, 'homework', null), null);
  await assert.rejects(() => f.db.query('select * from learning_vocab_cue_actions'), /permission denied/);
  await teacher(f.B);
  await assert.rejects(() => feedback(lesson), /bad_class/);

  await f.db.exec('reset role');
  const assignment = await idFor(lesson);
  await student();
  await assert.rejects(() => f.call('learning_vocab_cue_open', f.otherToken, assignment), /not_found/);
  await assert.rejects(() => feedback(lesson), /permission denied/);
  let state = await open(assignment);
  assert.equal(state.item.mode, 'spell');
  assert.equal(state.item.audio, null);
  await assert.rejects(() => f.call('learning_path_action', f.TK, assignment, crypto.randomUUID(), 1, 'answer', 'cat'), /use_vocab_cues/);
  const event = { id: crypto.randomUUID(), session: crypto.randomUUID(), position: state.position, question: null,
    action: 'shown', at: new Date().toISOString(), visible_ms: 0, input_recent_ms: 0 };
  assert.equal((await f.call('learning_sensor_report_run', state.run_id, f.TK, JSON.stringify([event]))).accepted, 1);
  const request = crypto.randomUUID();
  const first = await answer(assignment, state.revision, 'unknown', null, request);
  assert.deepEqual(await answer(assignment, state.revision, 'unknown', null, request), first);
  await assert.rejects(() => answer(assignment, state.revision, 'answer', 'cat', request), /bad_request/);
  await assert.rejects(() => answer(assignment, state.revision, 'unknown'), /path_changed/);
  state = first.state;
  const submit = async (action, value = null) => {
    state = (await answer(assignment, state.revision, action, value)).state;
  };
  const current = () => cards[state.item.word_index];
  const right = () => submit('answer', state.item.mode === 'spell' ? current().word : current().meaning);
  while (state.phase === 'diagnostic') {
    if (state.item.mode === 'listen') assert.equal(state.item.text, null);
    await submit(state.item.mode === 'listen' && current().word === 'dog' ? 'unavailable' : 'unknown');
  }
  const games = new Set();
  while (state.phase === 'learn') {
    await submit('continue');
    games.add(state.item.game);
    await right();
  }
  assert.deepEqual(games, new Set(['train', 'balloon']));
  assert.equal(state.verified_count, 0);
  while (state.phase === 'check') {
    assert.equal(state.item.game, null);
    if (state.item.mode === 'read' && current().word === 'dog') await submit('unknown');
    else await right();
  }
  assert.equal(state.waiting, true, '4/5 gaps reaches 80%');
  assert.deepEqual([state.gap_count, state.verified_count, state.session_day], [5, 4, 1]);
  await assert.rejects(() => submit('unknown'), /not_due/);
  await open(assignment);

  await teacher();
  const rows = await feedback(lesson);
  const dog = rows.find(row => row.student_id === f.ST && row.card.word === 'dog');
  assert.equal(dog.cues.listen.first, null);
  assert.equal(dog.cues.listen.unavailable, true);
  assert.equal(dog.cues.read.latest, false);
  assert.ok(rows.filter(row => row.student_id === silent).every(row => !row.ready && row.cues.read.latest === null));
  const draft = await f.call('learning_vocab_cue_draft', lesson, 'homework', null);
  assert.deepEqual(draft.students, [f.ST]);
  assert.equal(draft.cue.contexts[0].sentence, 'The dog sleeps beside my chair.');
  await assert.rejects(() => f.call('learning_vocab_approve', draft.id, f.HW, draft.students, 'Wrong engine',
    JSON.stringify(draft.cards), 'letters', false, draft.id, null), /use_vocab_cues/);
  const homeArgs = { id: draft.id, draft: draft.id, students: draft.students, modes: [], content: draft.cards };
  await assert.rejects(() => approve({ ...homeArgs, contexts: [{ ...draft.cue.contexts[0], sentence: 'A DOG can run fast!' }] }), /bad_context_reused/);
  const contexts = [{ ...draft.cue.contexts[0], sentence: 'The dog waits beside the blue gate.' }];
  const home = await approve({ ...homeArgs, contexts });
  assert.equal((await approve({ ...homeArgs, contexts })).duplicate, true);
  assert.equal((await feedback(lesson)).find(row => row.student_id === f.ST && row.card.word === 'dog').context_correct, null);
  await f.db.exec('reset role');
  const homework = await idFor(home.lesson_id);
  await student();
  const contextState = await open(homework);
  assert.equal(contextState.phase, 'context');
  assert.equal(contextState.item.text, contexts[0].sentence);
  assert.equal((await answer(homework, contextState.revision, 'unknown')).state.finished, true);

  state = await unlock(assignment);
  while (!state.waiting && state.session_day === 1) {
    if (state.phase === 'learn') await submit('continue');
    else if (state.item.mode === 'read' && current().word === 'dog' && state.phase !== 'practice') await submit('unknown');
    else if (state.item.mode === 'listen' && current().word === 'dog') await submit('unavailable');
    else await right();
  }
  assert.equal(state.session_day, 3);
  state = await unlock(assignment);
  let remediated = false;
  while (!state.waiting && state.session_day === 3) {
    assert.equal(current().word, 'dog');
    if (state.phase === 'review' && state.item.mode === 'read') await submit('unknown');
    else if (state.phase === 'learn') await submit('continue');
    else {
      if (state.phase === 'check') remediated = true;
      await right();
    }
  }
  assert.equal(remediated, true);
  assert.equal(state.session_day, 7);
  assert.equal(state.verified_count, 5);
  await teacher();
  const updatedDog = (await feedback(lesson)).find(row => row.student_id === f.ST && row.card.word === 'dog');
  assert.deepEqual([updatedDog.cues.read.latest, updatedDog.context_correct], [true, false]);
  const next = await f.call('learning_vocab_cue_draft', lesson, 'lesson', f.ST);
  assert.deepEqual(next.cue.modes, ['read']);
  assert.equal(next.cue.contextual, true);
  const nextLesson = await approve({ id: next.id, draft: next.id, students: next.students, modes: next.cue.modes,
    content: next.cards, contextual: next.cue.contextual });
  await f.db.exec('reset role');
  const nextAssignment = await idFor(nextLesson.lesson_id);
  await student();
  assert.equal((await open(nextAssignment)).item.text, 'A dog can run fast.');
  state = await unlock(assignment);
  while (!state.finished) await right();
  for (const supported of [true, false]) {
    await teacher();
    const small = await approve({ id: crypto.randomUUID(), content: [cards[0]], modes: ['spell'], students: [f.ST] });
    await f.db.exec('reset role');
    const smallAssignment = await idFor(small.lesson_id);
    await student();
    let nextState = await open(smallAssignment);
    const step = async (action, value = null) => {
      nextState = (await answer(smallAssignment, nextState.revision, action, value)).state;
    };
    await step('unknown');
    await step('continue');
    await step(supported ? 'answer' : 'unknown', supported ? 'cat' : null);
    await step('unknown');
    if (supported) {
      assert.equal(nextState.phase, 'learn', 'a useful same-day retry is available after supported success');
      await step('continue');
      await step('answer', 'cat');
      await step('unknown');
    }
    assert.equal(nextState.waiting, true);
    assert.equal(nextState.session_day, 1, 'remaining gaps continue on a different day');
  }
  await f.db.exec('reset role');
  await f.db.exec(f.read('116_rollback.sql'));
  await teacher();
  assert.equal((await f.call('learning_vocab_cue_feedback', f.HW, lesson)).cue_ready, false);
  await assert.rejects(() => approve({ id: crypto.randomUUID() }), /permission denied/);
  await student();
  assert.equal((await open(assignment)).finished, true);
  console.log('Vocabulary cues DB passed: frozen items and sensors, 80% rule, spaced retries, missing audio, contextual homework and teacher approvals.');
} catch (error) {
  console.error(error.message, error.detail ?? '', error.where ?? '');
  process.exitCode = 1;
} finally { await f.db.close(); }
