// Isolated PostgreSQL-in-WASM test database. No environment files or network/database credentials are read.
// Install test-only tools in node_modules/homework-test-tools (see progress document).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "vite";
import { PGlite } from "../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js";

import { app, sqlRoot, fixtureIds, installHomeworkFixture } from "./block-fixture.mjs";
const {a,otherA,c,otherC,owner,student,otherStudent}=fixtureIds;
const db=new PGlite();
const q = (s) => `'${s.replaceAll("'", "''")}'`;
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;
async function value(query) {
  return (await db.query(query)).rows[0]?.v;
}
async function rejects(query, pattern) {
  await assert.rejects(db.query(query), pattern);
}
let passed = 0;
async function test(name, cb) {
  await cb();
  passed++;
  console.log("ok", name);
}
const vite = await createServer({
  root: app,
  logLevel: "error",
  plugins: [
    {
      name: "no-network",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/src/lib/supabase.ts"))
          return "export const supabase = {};";
      },
    },
  ],
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});
try {
  await installHomeworkFixture(db);
  const blocks = await vite.ssrLoadModule("/src/lib/homework/blocks.ts");
  const cards = [
    { id: "cat", word: "cat", meaning: "고양이", example: "I like cats." },
    { id: "dog", word: "dog", meaning: "개", example: "I like dogs." },
    { id: "note", word: "rule", meaning: "문법 설명: 주어 뒤 동사원형" },
  ];
  const items = ["study", "recall", "speak", "sentence", "video"].map((type) =>
    type === "recall"
      ? blocks.blocksFromCards(cards, type)[0]
      : blocks.newBlock(type),
  );
  items.forEach((it) => {
    it.config.block.text = "I like cats.";
  });
  Object.assign(items[4].config.block, {
    videoUrl: "https://youtu.be/abcdefghijk",
    start: 3,
    end: 9,
  });
  items[0].config.block.guidedPractice = true;
  items[1].config.block.method = "guided-final:choice";
  const draft = { ...blocks.newDraft(), title: "Synthetic five blocks", items };
  await test("server migration compiles; five block definitions validate", async () => {
    assert.deepEqual(blocks.validateItems(items), []);
    await db.query(`select hw_validate_items(${json(items)})`);
  });
  await test("meaning notes excluded from distractors", async () => {
    const build = await vite.ssrLoadModule("/src/lib/homework/build.ts");
    for (let n = 0; n < 10; n++)
      assert(
        !JSON.stringify(build.meaningQ(cards[0], cards, Math.random)).includes(
          "문법",
        ),
      );
    const bad = structuredClone(items);
    bad[1].content.questions[0].choices[0] = "문법 설명: 주어 뒤 동사";
    await rejects(
      `select hw_validate_items(${json(bad)})`,
      /meaning_contains_notes/,
    );
  });
  await test("save/reopen and optimistic revision conflict", async () => {
    const saved = await value(`select hw_save_draft('${c}',${json(draft)}) v`);
    assert.equal(saved.revision, 1);
    assert.equal((await value(`select hw_drafts('${c}') v`)).length, 1);
    assert.deepEqual(
      (await value(`select hw_drafts('${c}') v`))[0].items,
      draft.items,
    );
    const second = await value(`select hw_save_draft('${c}',${json(saved)}) v`);
    assert.equal(second.revision, 2);
    await rejects(
      `select hw_save_draft('${c}',${json(saved)})`,
      /draft_conflict/,
    );
  });
  let assignment;
  const request = crypto.randomUUID();
  await test("idempotent assignment and immutable snapshot after draft edit", async () => {
    assignment = await value(
      `select hw_assign_draft('${c}',${json(draft)},null,null,'${request}') v`,
    );
    const duplicate = await value(
      `select hw_assign_draft('${c}',${json(draft)},null,null,'${request}') v`,
    );
    assert.equal(duplicate.id, assignment.id);
    const changed = structuredClone(draft);
    changed.items[0].config.block.text = "Changed";
    changed.revision = 2;
    await db.query(`select hw_save_draft('${c}',${json(changed)})`);
    await rejects(
      `update homework_items set title='Changed after assignment' where assignment_id='${assignment.id}'`,
      /assignment_version_frozen/,
    );
    await rejects(
      `select hw_assign_draft('${c}',${json(changed)},null,null,'${request}')`,
      /request_conflict/,
    );
    assert.equal(
      await value(
        `select config->'block'->>'text' v from homework_items where assignment_id='${assignment.id}' and position=0`,
      ),
      "I like cats.",
    );
  });
  const itemRows = (
    await db.query(
      `select * from homework_items where assignment_id='${assignment.id}' order by position`,
    )
  ).rows;
  await test('legacy quick/custom creation preserves targets and group; duplicate request creates once', async () => {
    const requestId = crypto.randomUUID(); const groupId = crypto.randomUUID();
    const command = `select hw_create_once('${requestId}','${c}','Synthetic quick custom',${json([items[0]])},array['${student}'::uuid],null,'custom','${groupId}','{"rule":"synthetic"}') v`;
    const first = await value(command); const second = await value(command);
    assert.equal(first.id, second.id);
    const row = (await db.query(`select kind,group_id,target_count,recommendation from homework_assignments where id='${first.id}'`)).rows[0];
    assert.equal(row.kind,'custom'); assert.equal(row.group_id,groupId); assert.equal(row.target_count,1); assert.equal(row.recommendation.rule,'synthetic');
  });
  let token;
  let attempt;
  const hintItem = crypto.randomUUID();
  await db.exec(
    `insert into homework_attempts(assignment_id,student_id) values('${assignment.id}','${student}')`,
  );
  ({ token, id: attempt } = (
    await db.query(
      `select token,id from homework_attempts where assignment_id='${assignment.id}'`,
    )
  ).rows[0]);
  const progress = (i, meta, id = crypto.randomUUID()) =>
    `select hw_progress('${token}','${itemRows[i].id}','item_complete',${json(meta)},'${id}') v`;
  await test("public payload omits answers, card snapshot and source version", async () => {
    const it = await value(
      `select hw_public_item(i) v from homework_items i where id='${itemRows[1].id}'`,
    );
    assert(!("correct" in it.content.questions[0]));
    assert(!("card" in it.content.questions[0]));
    assert(!("source" in it.config.block));
  });
  await test("completion requires confirmation / answers / recording / response / viewing", async () => {
    for (let i = 0; i < 5; i++) await rejects(progress(i, {}), /incomplete/);
    await rejects(`select hw_finish('${token}')`, /incomplete/);
  });
  await test("student item ownership and academy isolation", async () => {
    await rejects(
      `select hw_progress('${crypto.randomUUID()}','${itemRows[0].id}','item_complete','{}','${crypto.randomUUID()}')`,
      /not_found/,
    );
    await db.exec(`set test.academy='${otherA}'`);
    await rejects(`select hw_block_results('${assignment.id}')`, /not_found/);
    await rejects(`select hw_save_draft('${c}',${json(draft)})`, /bad_class/);
    await db.exec(`set test.academy='${a}'`);
  });
  await test("feature lock blocks teacher drafts and student activity", async () => {
    await db.exec(
      `update academies set features='{"homework":false}' where id='${a}'`,
    );
    await rejects(`select hw_drafts('${c}')`, /feature_closed/);
    await rejects(progress(0, { confirmed: true }), /feature_closed/);
    await db.exec(
      `update academies set features='{"homework":true}' where id='${a}'`,
    );
  });
  await test("study confirmation and repeated submission stored once", async () => {
    const id = crypto.randomUUID();
    await db.query(progress(0, { confirmed: true }, id));
    await db.query(progress(0, { confirmed: true }, id));
    assert.equal(
      Number(
        await value(
          `select count(*) v from learning_events where item_id='${itemRows[0].id}'`,
        ),
      ),
      1,
    );
  });
  await test("spelling hints: allowed level enforced, mask by level, used level recorded for teacher results, not shown without setting", async () => {
    const q = { id: "road", qtype: "text", prompt: "도로", word: "", correct: "road", guidedSpelling: true, skill: "x", gen: "t" };
    const cfg = (policy) => ({ block: { schemaVersion: 1, type: "recall", completion: "answers", guidedPractice: true, ...(policy ? { spellingHints: policy } : {}) } });
    await db.exec('alter table homework_items disable trigger user');
    await db.exec(`insert into homework_items(id,assignment_id,position,kind,title,config,content) values('${hintItem}','${assignment.id}',-1,'quiz','hint',${json(cfg({ defaultLevel: 1, overrides: {} }))},${json({ questions: [q] })})`);
    const hint = async (level) => JSON.parse(JSON.stringify(await value(`select hw_spelling_hint('${token}','${hintItem}',0,${level}) v`)));
    assert.equal((await hint(0)).mask, "");
    await rejects(`select hw_spelling_hint('${token}','${hintItem}',0,2)`, /hint_not_allowed/);
    const first = await hint(1);
    assert.equal(first.mask, "r _ _ _"); assert.equal(first.used, 1); assert.equal(first.allowed, 1);
    assert.equal((await hint(0)).mask, "r _ _ _");
    const pub = JSON.stringify(await value(`select hw_public_item(i) v from homework_items i where id='${hintItem}'`));
    assert.ok(!pub.includes('"correct"') && !pub.includes('spellingHints'));
    await db.exec(`update homework_items set config=${json(cfg({ defaultLevel: 1, overrides: { [student]: 2 } }))} where id='${hintItem}'`);
    const second = await hint(2);
    assert.equal(second.mask, "r _ a _"); assert.equal(second.used, 2);
    await db.exec(`update homework_items set config=${json(cfg({ defaultLevel: 0, overrides: {} }))} where id='${hintItem}'`);
    await rejects(`select hw_spelling_hint('${token}','${hintItem}',0,1)`, /hint_not_allowed/);
    await db.exec(`delete from homework_items where id='${hintItem}'`);
    await db.exec('alter table homework_items enable trigger user');
  });
  await test("recall first and retry results kept separately; cross-token client id reuse denied", async () => {
    const sameClassPeer = crypto.randomUUID();
    await db.exec(
      `insert into students(id,academy_id,class_id,name) values('${sameClassPeer}','${a}','${c}','Synthetic peer');insert into homework_attempts(assignment_id,student_id) values('${assignment.id}','${sameClassPeer}')`,
    );
    const peerToken = await value(
      `select token v from homework_attempts where student_id='${sameClassPeer}'`,
    );
    const privateRequest = crypto.randomUUID();
    await db.query(
      `select hw_submit('${token}','${itemRows[1].id}',0,'wrong','${privateRequest}',100)`,
    );
    await rejects(
      `select hw_submit('${peerToken}','${itemRows[1].id}',0,'wrong','${privateRequest}',100)`,
      /not_found/,
    );
    const questions = items[1].content.questions;
    for (let index = 0; index < questions.length; index++) {
      const correct = questions[index].correct;
      const right =
        typeof correct === "number" ? String(correct) : String(correct);
      await db.query(
        `select hw_submit('${token}','${itemRows[1].id}',${index},${q("wrong")},'${crypto.randomUUID()}',200)`,
      );
      await db.query(
        `select hw_submit('${token}','${itemRows[1].id}',${index},${q(right)},'${crypto.randomUUID()}',200)`,
      );
    }
    await db.query(progress(1, {}));
    const r = (
      await value(`select hw_block_results('${assignment.id}') v`)
    ).find((r) => r.item_id === itemRows[1].id);
    assert.equal(r.first_correct, 0);
    assert.equal(r.student_id,student);
    assert.equal(r.check_type,"choice");
    assert.ok(r.check_misses.some(card=>card.word==="cat"));
    assert.ok(!Object.hasOwn(r.check_misses[0],"response"));
    const practice = (await value("select hw_block_results('"+assignment.id+"') v")).find(row=>row.item_id===itemRows[0].id);
    assert.equal(practice.guided_practice,true);
    assert.equal(practice.check_type,null);
    assert(Number(r.final_correct) > 0);
  });
  await test("representative audio requires private storage ownership; review unscored", async () => {
    await rejects(
      progress(2, { recording: "other/file", duration: 1 }),
      /incomplete/,
    );
    const path = await value(
      `select hw_recording_target('${token}','${itemRows[2].id}') v`,
    );
    await db.exec(
      `insert into storage.objects(bucket_id,name) values('homework-recordings',${q(path)})`,
    );
    await db.query(
      progress(2, { recording: path, duration: 1, hints: 2, listens: 3 }),
    );
    const r = (
      await value(`select hw_block_results('${assignment.id}') v`)
    ).find((r) => r.item_id === itemRows[2].id);
    assert.equal(r.total, 0);
    assert.equal(r.meta.review, "pending");
    await db.query(`select hw_review_block('${attempt}','${itemRows[2].id}')`);
    assert.equal(
      await value(
        `select meta->>'review' v from homework_item_attempts where item_id='${itemRows[2].id}'`,
      ),
      "reviewed",
    );
  });
  await test("open sentence accepted for teacher review; viewing has no score", async () => {
    await db.query(progress(3, { response: "Several valid answers." }));
    await db.query(progress(4, { watched: true }));
    const r = await value(`select hw_finish('${token}') v`);
    assert.equal(r.total, items[1].content.questions.length);
    assert.equal(
      await value(
        `select meta->>'review' v from homework_item_attempts where item_id='${itemRows[3].id}'`,
      ),
      "pending",
    );
  });
  await test("private endpoints not executable by anonymous students", async () => {
    await db.exec("set role anon");
    await rejects(`select hw_drafts('${c}')`, /permission denied/);
    await rejects(
      `select hw_recording_target('${token}','${itemRows[2].id}')`,
      /permission denied/,
    );
    await rejects(`select * from homework_drafts`, /permission denied/);
    await db.exec("reset role");
  });
  await test("cleanup candidates exclude recent/referenced recordings", async () => {
    assert.deepEqual(
      await value("select hw_recording_cleanup_candidates() v"),
      [],
    );
    await db.exec(
      `insert into storage.objects(bucket_id,name,created_at) values('homework-recordings','abandoned',now()-interval '2 days')`,
    );
    assert.deepEqual(
      await value("select hw_recording_cleanup_candidates() v"),
      ["abandoned"],
    );
  });
  await test("lesson conversion distinguishes unsupported / alternative; source version survives copy", async () => {
    const lesson = {
      id: crypto.randomUUID(),
      updated_at: "2026-10-18",
      word_list_id: null,
      playlist: [
        { id: "a", kind: "study", words: cards },
        { id: "b", kind: "attendance" },
        { id: "c", kind: "game", gameType: "quiz" },
      ],
    };
    const out = blocks.lessonCandidates(lesson, []);
    assert.equal(out[0].status, "convert");
    assert.equal(out[1].status, "unsupported");
    assert.equal(out[2].status, "unsupported");
    assert.equal(
      out[0].items[0].config.block.source.version,
      lesson.updated_at,
    );
  });
  await test("short memory persists rounds, enforces minimum and inclusive accuracy, and finishes once", async () => {
    await db.exec(readFileSync(resolve(sqlRoot, "144_short_memory_rounds.sql"), "utf8"));
    const recall = blocks.newBlock('recall');
    recall.content.questions = Array.from({length:5}, (_,i) => ({
      id:String(i), qtype:'text', style:'spell', prompt:'뜻 '+i, correct:'road', word:'road',
    }));
    const make = (minimum, threshold) => `select hw_assign_short('${c}',${json({...blocks.newDraft(),title:'Rounds',items:[recall],shortRepeat:{minimum,threshold}})},array['${student}'::uuid],null,'${crypto.randomUUID()}') v`;
    await rejects(make(2,100), /invalid_repeat_policy/);
    const create = make(2,80);
    const assigned = await value(create);
    assert.deepEqual(await value(create), assigned);
    const item = await value(`select id v from homework_items where assignment_id='${assigned.id}'`);
    let key = await value(`insert into homework_attempts(assignment_id,student_id) values('${assigned.id}','${student}') returning token v`);
    const firstKey = key;
    for (const [index,hits] of [5,4,5].entries()) {
      const state = await value(`select hw_state('${key}') v`);
      assert.equal(state.shortRepeat.round,index+1);
      assert.equal(state.shortRepeat.lastScore,[null,5,4][index]);
      assert.equal(state.finished,false);
      assert.deepEqual(state.answers,[]);
      await rejects(`select hw_finish('${key}')`,/incomplete/);
      await rejects(`select hw_short_finish('${key}')`,/incomplete/);
      for (let question=0; question<5; question++) {
        await db.query(`select hw_submit('${key}','${item}',${question},'${question<hits?'road':'no'}','${crypto.randomUUID()}',1)`);
        if(question===0) assert.equal((await value(`select hw_state('${key}') v`)).answers.length,1);
      }
      await db.query(`select hw_progress('${key}','${item}','item_complete','{}','${crypto.randomUUID()}')`);
      const finish = `select hw_short_finish('${key}') v`;
      const receipt = await value(finish);
      assert.deepEqual(await value(finish),receipt);
      if (index<2) {
        assert.equal(await value(`select hw_short_resume('${key}') v`),receipt.next_token);
        await rejects(`select hw_submit('${key}','${item}',0,'road','${crypto.randomUUID()}',1)`,/not_found/);
        key=receipt.next_token;
      } else assert.deepEqual(receipt,{score:5,total:5});
    }
    assert.equal(await value(`select hw_short_resume('${firstKey}') v`),key);
    assert.equal((await value(`select hw_state('${key}') v`)).finished,true);
    const count = type => value(`select count(*)::int v from learning_events where assignment_id='${assigned.id}' and event_type='${type}'`);
    assert.equal(await count('answer'),5);
    assert.equal(await count('retry_answer'),10);
    assert.equal(await count('assignment_complete'),1);
  });
  await test("published homework edits preserve codes and attempts; reissue creates a separate assignment", async () => {
    await db.exec(readFileSync(resolve(sqlRoot, "151_edit_published_homework.sql"), "utf8"));
    const original = await value(`select hw_assign_draft('${c}',${json(draft)},array['${student}'::uuid],now()-interval '1 day','${crypto.randomUUID()}') v`);
    const read = () => value(`select hw_publication('${original.id}') v`);
    const previous = await read();
    assert.deepEqual(previous.students,[student]);
    const revised = structuredClone(previous.items);
    revised[0].config.block.text='Revised study material';
    const due='2027-03-02T14:59:59.999Z';
    const apply = (version,title,content) => `select hw_revise_publication('${original.id}',${q(version)},${q(title)},'${due}',${json(content)})`;
    await db.query(apply(previous.version,'Extended',revised));
    await db.query(apply(previous.version,'Extended',revised));
    const latest = await read();
    assert.deepEqual(latest.items,revised);
    assert.equal(Date.parse(latest.due),Date.parse(due));
    assert.equal(await value(`select code v from homework_assignments where id='${original.id}'`),original.code);
    await rejects(apply(previous.version,'Stale',previous.items), /publication_changed/);
    await db.query(`insert into homework_attempts(assignment_id,student_id) values('${original.id}','${student}')`);
    await rejects(apply(latest.version,'Changed',previous.items),/publication_started/);
    await db.query(apply(latest.version,'Updated title',revised));
    const copyRequest=crypto.randomUUID();
    const copy=`select hw_assign_draft('${c}',${json({...draft,items:previous.items})},array['${student}'::uuid],'${due}','${copyRequest}') v`;
    const issued=await value(copy);
    assert.notEqual(issued.code,original.code);
    assert.deepEqual(await value(copy),issued);
    assert.equal((await read()).started,true);
    assert.equal(await value(`select has_function_privilege('anon','public.hw_publication(uuid)','execute') v`),false);
    await db.exec(`set test.academy='${otherA}'`);
    await rejects(`select hw_publication('${original.id}')`,/bad_class|not_found/);
    await db.exec(`set test.academy='${a}'`);
  });
  await test("editing started homework keeps linked evidence, submitted results and the same student links", async () => {
    await db.exec("alter table homework_attempts add column if not exists rewarded_at timestamptz");
    await db.exec(readFileSync(resolve(sqlRoot, "152_edit_homework_activities.sql"), "utf8"));
    const recall = blocks.newBlock('recall');
    recall.content.questions = [{id:'road',qtype:'text',style:'spell',prompt:'길',correct:'road',word:'road'}];
    const quiz = {...recall,title:'Second quiz'};
    const classmate = crypto.randomUUID();
    await db.query(`insert into students(id,academy_id,class_id,name) values('${classmate}','${a}','${c}','Synthetic C')`);
    const issued = await value(`select hw_assign_draft('${c}',${json({...draft,items:[recall,quiz]})},
      array['${student}'::uuid,'${classmate}'::uuid],null,'${crypto.randomUUID()}') v`);
    const read = () => value(`select hw_publication('${issued.id}') v`);
    const original = await read();
    const [first,second] = original.itemIds;
    const start = who => value(`insert into homework_attempts(assignment_id,student_id) values('${issued.id}','${who}') returning token v`);
    const working = await start(student);
    const submitted = await start(classmate);
    const answer = (key,item) => db.query(`select hw_submit('${key}','${item}',0,'road','${crypto.randomUUID()}',1)`);
    const complete = (key,item) => db.query(`select hw_progress('${key}','${item}','item_complete','{}','${crypto.randomUUID()}')`);
    const state = key => value(`select hw_state('${key}') v`);
    for (const item of original.itemIds) {
      await answer(submitted,item); await complete(submitted,item);
      await answer(working,item); await complete(working,item);
    }
    assert.deepEqual(await value(`select hw_finish('${submitted}') v`),{score:2,total:2});
    const next = [{...quiz,title:'New activity',content:{questions:[...quiz.content.questions,{...quiz.content.questions[0],id:'more'}]}},original.items[1]];
    const edit = (ids) => `select hw_edit_activities('${issued.id}',${q(original.version)},'Revised',null,${json(next)},${ids})`;
    await rejects(edit(`array['${second}','${second}']::uuid[]`),/bad_items/);
    await rejects(edit(`array[null,'${crypto.randomUUID()}']::uuid[]`),/bad_items/);
    const save = edit(`array[null,'${second}']::uuid[]`);
    await db.query(save); await db.query(save);
    const current = await read();
    assert.equal(current.itemIds[1],second);
    assert.deepEqual((await state(submitted)).items.map(i=>i.id),[first,second]);
    assert.deepEqual((await state(working)).items.map(i=>i.id),current.itemIds);
    assert.deepEqual((await state(working)).answers.map(i=>i.item_id),[second]);
    assert.deepEqual(await value(`select hw_finish('${submitted}') v`),{score:2,total:2});
    await rejects(`select hw_finish('${working}')`,/incomplete/);
    await rejects(`select hw_submit('${working}','${first}',0,'road','${crypto.randomUUID()}',1)`,/not_found/);
    assert.equal(await value(`select count(*)::int v from homework_answers where item_id='${first}'`),2);
    assert.equal(await value(`select count(*)::int v from learning_events where item_id='${first}' and event_type='answer'`),2);
    const report = await value(`select hw_assignment_summary('${issued.id}') v`);
    assert.equal(report.students.find(s=>s.student_id===student).answered,1);
    assert.equal(report.students.find(s=>s.student_id===classmate).submitted_total,2);
    const results = await value(`select hw_block_results('${issued.id}') v`);
    assert.deepEqual(results.filter(row=>row.student_id===classmate).map(row=>row.item_id),[first,second]);
    await answer(working,current.itemIds[0]);
    await db.query(`select hw_submit('${working}','${current.itemIds[0]}',1,'wrong','${crypto.randomUUID()}',1)`);
    await complete(working,current.itemIds[0]);
    assert.deepEqual(await value(`select hw_finish('${working}') v`),{score:2,total:3});
    assert.equal(await value(`select code v from homework_assignments where id='${issued.id}'`),issued.code);
    assert.equal(await value("select has_function_privilege('anon','hw_edit_activities(uuid,text,text,timestamptz,jsonb,uuid[])','execute') v"),false);
  });
  await test("manual rollback compiles and retains draft/submission data", async () => {
    await db.exec(
      readFileSync(
        resolve(sqlRoot, "087_homework_blocks_rollback.sql"),
        "utf8",
      ),
    );
    assert.equal(
      Number(await value("select count(*) v from homework_drafts")),
      1,
    );
    assert(
      Number(await value("select count(*) v from homework_item_attempts")) >= 5,
    );
  });
  console.log(
    `\n${passed} block/database checks passed. In-memory synthetic data only.`,
  );
} catch (error) {
  console.error(
    "FAILED:",
    error.message,
    error.detail || "",
    error.where || "",
    "position:",
    error.position || "",
  );
  process.exitCode = 1;
} finally {
  await vite.close();
  await db.close();
}
