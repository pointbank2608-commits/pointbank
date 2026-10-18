// Synthetic PostgreSQL/WASM only. Never reads environment files or connects to a server.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (name) => readFileSync(resolve(root, 'supabase', name), 'utf8');
const db = new PGlite();
const table = (file, name) => {
  const sql = read(file);
  const at = sql.indexOf(`create table if not exists public.${name} (`);
  assert(at >= 0, name);
  return sql.slice(at, sql.indexOf('\n);', at) + 3);
};
const fn = (file, name) => {
  const sql = read(file);
  const at = sql.indexOf(`create or replace function public.${name}(`);
  assert(at >= 0, name);
  const body = sql.indexOf('as $', at);
  const tag = sql.slice(body + 3).match(/^\$\w*\$/)[0];
  return sql.slice(
    at,
    sql.indexOf(tag + ';', body + 3 + tag.length) + tag.length + 1,
  );
};
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const quote = (s) => `'${String(s).replaceAll("'", "''")}'`;
const json = (v) => `${quote(JSON.stringify(v))}::jsonb`;
const val = async (sql) => (await db.query(sql)).rows[0].v;
let count = 0;
const test = async (name, cb) => {
  await cb();
  console.log('ok', name);
  count++;
};
const academy = id(1),
  cls = id(2),
  student = id(3),
  other = id(4),
  token = id(5),
  otherToken = id(6),
  tpl = id(7),
  lesson = id(8),
  assignment = id(9);
try {
  await db.exec(`create role anon;create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create table academies(id uuid primary key,features jsonb default '{"solo":true,"homework":true}');
    create table classes(id uuid primary key,academy_id uuid);
    create table word_lists(id uuid primary key);
    create table word_bank(word text,meaning text,part_of_speech text,sense_number int);
    create table student_guardian(student_id uuid,record_consent_at timestamptz);
    create table students(id uuid primary key,academy_id uuid,class_id uuid,name text,archived_at timestamptz);
    create table game_templates(id uuid primary key,academy_id uuid,class_id uuid,game_type text,name text,items jsonb,config jsonb);
    create table transactions(student_id uuid,is_homework boolean,delta int,created_at timestamptz);
    create function public.hw_staff_academy() returns uuid language sql as $$select nullif(current_setting('test.academy',true),'')::uuid$$;
    create function public.academy_feature(a uuid,k text) returns boolean language sql as $$select coalesce((features->>k)::boolean,false) from academies where id=a$$;
    create table student_sessions(token uuid primary key,student_id uuid);
    create function public.student_session_student(p_token uuid) returns uuid language plpgsql as $$declare sid uuid;begin select student_id into sid from student_sessions where token=p_token;if sid is null then raise exception 'expired';end if;return sid;end$$;
  `);
  for (const name of [
    'homework_assignments',
    'homework_attempts',
    'homework_answers',
  ])
    await db.exec(table('040_homework.sql', name));
  await db.exec(
    `alter table homework_assignments add column kind text default 'class';create table homework_assignment_targets(assignment_id uuid,student_id uuid);`,
  );
  for (const name of [
    'homework_items',
    'homework_item_attempts',
    'learning_events',
  ])
    await db.exec(table('041_homework_v2.sql', name));
  for (const name of ['solo_lessons', 'solo_assignments', 'solo_step_events'])
    await db.exec(table('047_solo_lessons.sql', name));
  await db.exec(
    `alter table solo_lessons add column origin text;alter table solo_assignments add column kind text default 'lesson',add column help_at timestamptz,add column help_step int;alter table solo_step_events add column word text,add column skill text;create table solo_test_results(assignment_id uuid,step_index int);`,
  );
  for (const [file, names] of [
    ['047_solo_lessons.sql', ['solo_norm', 'solo_open']],
    [
      '050_solo_grammar_steps.sql',
      ['solo_grade', 'solo_public_step', 'solo_correct_text'],
    ],
    [
      '057_solo_review.sql',
      [
        'solo_step_word',
        'solo_word_stats',
        'solo_review_pool',
        'solo_start_review',
      ],
    ],
    [
      '060_solo_stats.sql',
      ['solo_first_answers', 'student_skill_events', 'student_learning_card'],
    ],
    ['041_homework_v2.sql', ['student_review_candidates']],
    ['074c_feature_guards.sql', ['solo_assignment_for']],
    ['064_solo_fix_error.sql',['solo_norm_loose','solo_fix_matches']],
    ['065_solo_write_blocks.sql',['solo_cond_ok','solo_public_step','solo_grade','solo_correct_text']],
    ['051_solo_song_recordings.sql',['solo_open']],
  ])
    for (const name of names) await db.exec(fn(file, name));
  await db.exec(read('088a_game_learning.sql'));
  await db.exec(read('088b_personal_game_review.sql'));
  const words = [
    ['apple', '사과'],
    ['banana', '바나나'],
    ['cat', '고양이'],
    ['dog', '강아지'],
  ];
  await db.exec(`insert into academies(id)values('${academy}');insert into classes values('${cls}','${academy}');insert into students values('${student}','${academy}','${cls}','Alice',null),('${other}','${academy}','${cls}','Bob',null);insert into student_sessions values('${token}','${student}'),('${otherToken}','${other}');
    insert into game_templates values('${tpl}','${academy}','${cls}','matchup','Synthetic game','[]',${json({ pairs: words.map(([left, right]) => ({ id: crypto.randomUUID(), left, right })) })});
    insert into solo_lessons(id,academy_id,class_id,name,steps)values('${lesson}','${academy}','${cls}','Lesson',${json([{ t: 'game', gameType: 'matchup', templateId: tpl, title: 'Pairs' }])});
    insert into solo_assignments(id,academy_id,lesson_id,student_id)values('${assignment}','${academy}','${lesson}','${student}');set test.academy='${academy}';`);
  const open = () =>
    val(`select solo_game_check_open('${token}','${assignment}',0) v`);
  let state;
  await test('checkpoint snapshot is stable, no answers or private cards in public questions', async () => {
    state = await open();
    assert.equal(state.questions.length, 4);
    assert.deepEqual(await open(), state);
    for (const q of state.questions) {
      assert(!('answer' in q));
      assert(!('_card' in q));
      assert(!('skill' in q));
      assert.equal(q.t, 'pickMeaning');
    }
    assert.equal(await val(`select count(*)::int v from solo_game_checks`), 1);
  });
  await test('another student / invalid token / wrong step cannot open or answer', async () => {
    await assert.rejects(openOther(), /not_found/);
    await assert.rejects(
      val(`select solo_game_check_open('${id(99)}','${assignment}',0) v`),
      /expired/,
    );
    await assert.rejects(
      val(`select solo_game_check_open('${token}','${assignment}',2) v`),
      /not_found/,
    );
    await assert.rejects(
      val(
        `select solo_game_check_answer('${otherToken}','${assignment}',0,0,'0','${id(100)}') v`,
      ),
      /not_found/,
    );
  });
  function openOther() {
    return val(
      `select solo_game_check_open('${otherToken}','${assignment}',0) v`,
    );
  }
  const correct = await val(
    `select questions->0->>'answer' v from solo_game_checks where assignment_id='${assignment}'`,
  );
  await test('first wrong, idempotent network replay, retry correct stays separate', async () => {
    const wrong = String((Number(correct) + 1) % 4);
    const req = id(101);
    const first = await val(
      `select solo_game_check_answer('${token}','${assignment}',0,0,'${wrong}','${req}') v`,
    );
    assert.equal(first.correct, false);
    const replay = await val(
      `select solo_game_check_answer('${token}','${assignment}',0,0,'${correct}','${req}') v`,
    );
    assert.equal(replay.correct, false);
    assert.equal(await val(`select count(*)::int v from learning_events`), 1);
    const retry = await val(
      `select solo_game_check_answer('${token}','${assignment}',0,0,'${correct}','${id(102)}') v`,
    );
    assert.equal(retry.correct, true);
    assert.equal(retry.first, false);
    assert.deepEqual(
      (
        await db.query(
          `select event_type,correct from learning_events order by id`,
        )
      ).rows,
      [
        { event_type: 'answer', correct: false },
        { event_type: 'retry_answer', correct: true },
      ],
    );
    assert.equal(
      await val(
        `select count(*)::int v from student_skill_events('${student}',now()-interval '1 day')`,
      ),
      1,
    );
  });
  await test('other questions score independently, repeated failure raises help signal', async () => {
    await val(
      `select solo_game_check_answer('${token}','${assignment}',0,1,'-1','${id(103)}') v`,
    );
    assert.equal(
      await val(
        `select help_at is not null v from solo_assignments where id='${assignment}'`,
      ),
      true,
    );
    await assert.rejects(
      val(
        `select solo_game_check_answer('${token}','${assignment}',0,2,'0','${id(101)}') v`,
      ),
      /bad_request/,
    );
  });
  await test('same-day duplicate game counts as retry; source cards feed recommendations and next lesson', async () => {
    const second = id(10),
      secondLesson = id(11);
    await db.exec(
      `insert into solo_lessons(id,academy_id,class_id,name,steps)select '${secondLesson}',academy_id,class_id,'Other game',steps from solo_lessons where id='${lesson}';insert into solo_assignments(id,academy_id,lesson_id,student_id)values('${second}','${academy}','${secondLesson}','${student}');`,
    );
    const s = await val(
      `select solo_game_check_open('${token}','${second}',0) v`,
    );
    const firstWord = state.questions[0].word;
    const qi = s.questions.findIndex((q) => q.word === firstWord);
    const ans = await val(
      `select questions->${qi}->>'answer' v from solo_game_checks where assignment_id='${second}'`,
    );
    await val(
      `select solo_game_check_answer('${token}','${second}',0,${qi},'${ans}','${id(104)}') v`,
    );
    assert.equal(
      await val(
        `select event_type v from learning_events where client_id='${id(104)}'`,
      ),
      'retry_answer',
    );
    const rec = await val(`select student_review_candidates('${student}') v`);
    assert(rec.words.some((w) => w.word === firstWord && w.card.meaning));
    const pool = await val(`select solo_review_pool('${token}') v`);
    assert(pool.some((w) => w.word === firstWord && w.meaning));
    // Add remaining valid answers so the preparation exercise has a useful pool.
    for (let i = 2; i < 4; i++) {
      const answer = await val(
        `select questions->${i}->>'answer' v from solo_game_checks where assignment_id='${assignment}'`,
      );
      await val(
        `select solo_game_check_answer('${token}','${assignment}',0,${i},'${answer}','${id(105 + i)}') v`,
      );
    }
    const start = await val(
      `select solo_start_personal_game('${token}','${assignment}') v`,
    );
    assert(start.assignment);
    assert.equal(
      (
        await val(
          `select solo_start_personal_game('${token}','${assignment}') v`,
        )
      ).assignment,
      start.assignment,
    );
    assert.equal(
      (await val(`select solo_open('${token}','${start.assignment}') v`))
        .personal_review,
      true,
    );
    const card = await val(`select student_learning_card('${student}',30) v`);
    assert(card.graded >= 4);
    assert(card.solo.graded >= 4);
    assert(card.wrong_words.length >= 1);
  });
  await test('permissions, closed features, teacher scope and idempotent migrations', async () => {
    assert.equal(
      await val(
        `select has_table_privilege('anon','public.solo_game_checks','select') v`,
      ),
      false,
    );
    assert.equal(
      await val(
        `select has_function_privilege('anon','public.solo_game_check_state(uuid)','execute') v`,
      ),
      false,
    );
    await db.exec(`set role anon`);
    await assert.rejects(
      db.query('select * from solo_game_checks'),
      /permission denied/,
    );
    await db.exec('reset role');
    await db.exec(`set test.academy='${id(999)}'`);
    await assert.rejects(
      val(`select student_game_growth('${student}',30) v`),
      /not_found/,
    );
    await db.exec(`set test.academy='${academy}'`);
    await db.exec(
      `update academies set features='{"solo":false,"homework":false}'`,
    );
    await assert.rejects(open(), /feature_closed/);
    await assert.rejects(
      val(`select solo_start_personal_game('${token}') v`),
      /feature_closed/,
    );
    await db.exec(
      `update academies set features='{"solo":true,"homework":true}'`,
    );
    await db.exec(read('088a_game_learning.sql'));
    await db.exec(read('088b_personal_game_review.sql'));
    assert.equal((await open()).id, state.id);
  });
  await test('typed checkpoints use current game words, hide answers, and preserve snapshots', async () => {
    const newTpl = id(30),
      newLesson = id(31),
      newAssignment = id(32);
    await db.exec(`insert into game_templates values('${newTpl}','${academy}','${cls}','anagram','Letters',${json(
      [
        { id: 'a', label: 'apple' },
        { id: 'b', label: 'banana' },
      ],
    )},${json({
      classroomSource: {
        cards: [
          { word: 'apple', meaning: '사과' },
          { word: 'banana', meaning: '바나나' },
          { word: 'outside', meaning: '이전 자료' },
        ],
      },
    })});
      insert into solo_lessons(id,academy_id,class_id,name,steps)values('${newLesson}','${academy}','${cls}','Letters',${json([{ t: 'game', gameType: 'anagram', templateId: newTpl, title: 'Letters' }])});
      insert into solo_assignments(id,academy_id,lesson_id,student_id)values('${newAssignment}','${academy}','${newLesson}','${student}');`);
    const st = await val(
      `select solo_game_check_open('${token}','${newAssignment}',0) v`,
    );
    assert.equal(st.questions.length, 2);
    assert(
      st.questions.every(
        (q) => q.t === 'typeWord' && !('word' in q) && q.first === '',
      ),
    );
    const answer = await val(
      `select questions->0->>'word' v from solo_game_checks where assignment_id='${newAssignment}'`,
    );
    const answerResult = await val(
      `select solo_game_check_answer('${token}','${newAssignment}',0,0,${quote(answer.toUpperCase())},'${id(33)}') v`,
    );
    assert.equal(answerResult.correct, true);
    await db.exec(
      `update game_templates set items='[]',config='{}' where id='${newTpl}'`,
    );
    assert.deepEqual(
      (
        await val(
          `select solo_game_check_open('${token}','${newAssignment}',0) v`,
        )
      ).questions,
      st.questions,
    );
    await db.exec(
      `update solo_lessons set steps=${json([{ t: 'game', gameType: 'anagram', templateId: newTpl, title: 'Letters', measure: false }])} where id='${newLesson}'`,
    );
    assert.equal(
      (
        await val(
          `select solo_game_check_open('${token}','${newAssignment}',0) v`,
        )
      ).disabled,
      true,
    );
  });
  await test('homework words work in legacy review, no unknown words, growth badges and read-only checks', async () => {
    const review = await val(
      `select solo_start_review('${token}','Legacy review',3,${json([
        { t: 'intro', title: 'Review', text: '' },
        {
          t: 'pickMeaning',
          word: 'apple',
          imageUrl: null,
          options: ['사과', '바나나'],
          answer: 0,
        },
      ])}) v`,
    );
    assert(review.assignment);
    await assert.rejects(
      val(
        `select solo_start_review('${token}','Unknown',3,${json([
          { t: 'intro', title: 'Review', text: '' },
          {
            t: 'pickMeaning',
            word: 'nevermet',
            imageUrl: null,
            options: ['사과', '바나나'],
            answer: 0,
          },
        ])}) v`,
      ),
      /bad_words/,
    );
    await db.exec(`insert into learning_events(academy_id,student_id,event_type,skill,word,correct,meta,created_at)values
      ('${academy}','${student}','answer','vocab.meaning','retained',true,'{"source":"solo_game"}',now()-interval '2 days'),
      ('${academy}','${student}','answer','vocab.meaning','retained',true,'{"source":"solo_game"}',now()),
      ('${academy}','${student}','answer','vocab.spelling','retained',true,'{"source":"solo_game"}',now());`);
    const growth = await val(`select student_game_growth('${student}',30) v`);
    assert(growth.checked >= 1);
    assert(growth.remembered >= 1);
    assert(growth.transferred >= 1);
    const results = await val(`select solo_game_results('${lesson}') v`);
    assert.equal(results[0].wrong_count, 2);
    assert.equal(results[0].right_count, 2);
    assert.equal(results[0].missed_words.length, 2);
    const checks = (await db.query(read('088_check.sql'))).rows[0];
    assert(
      Object.values(checks).every((v) => v === true),
      JSON.stringify(checks),
    );
  });
  await test('rollback preserves data and restores original functions; migration can be reapplied', async () => {
    const n = await val('select count(*)::int v from learning_events');
    await db.exec(read('088_rollback.sql'));
    assert.equal(await val('select count(*)::int v from learning_events'), n);
    assert.equal(
      await val(
        `select has_function_privilege('anon','public.solo_game_check_open(uuid,uuid,int)','execute') v`,
      ),
      false,
    );
    await db.exec(read('088a_game_learning.sql'));
    await db.exec(read('088b_personal_game_review.sql'));
    assert.equal((await open()).id, state.id);
  });
  console.log(
    `All ${count} game learning database checks passed. Synthetic data only.`,
  );
} finally {
  await db.close();
}
