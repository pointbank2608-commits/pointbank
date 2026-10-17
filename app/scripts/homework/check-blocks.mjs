// Isolated PostgreSQL-in-WASM test database. No environment files or network/database credentials are read.
// Install test-only tools in node_modules/homework-test-tools (see progress document).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { PGlite } from "../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sqlRoot = resolve(app, "../supabase");
const sql41 = readFileSync(resolve(sqlRoot, "041_homework_v2.sql"), "utf8");
const sql40 = readFileSync(resolve(sqlRoot, "040_homework.sql"), "utf8");
const db = new PGlite();
const fixture = `
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 create table academies(id uuid primary key,features jsonb default '{"homework":true}');
 create table classes(id uuid primary key,academy_id uuid references academies(id));
 create table students(id uuid primary key,academy_id uuid,class_id uuid,name text,archived_at timestamptz);
 create table word_lists(id uuid primary key);
 create function public.my_academy_id() returns uuid language sql stable as $$ select nullif(current_setting('test.academy',true),'')::uuid $$;
 create function public.is_staff() returns boolean language sql stable as $$ select auth.uid() is not null $$;
 create function public.academy_feature(a uuid,k text) returns boolean language sql stable as $$ select coalesce((features->>k)::boolean,false) from academies where id=a $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text,created_at timestamptz default now(),user_metadata jsonb default '{"duration":"1"}');
`;
function table(sql, name) {
  const start = sql.indexOf(`create table if not exists public.${name} (`);
  assert(start >= 0);
  return sql.slice(start, sql.indexOf("\n);", start) + 3);
}
function fn(sql, name) {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert(start >= 0, name);
  const open = sql.indexOf("$$", start);
  return sql.slice(start, sql.indexOf("$$;", open + 2) + 3);
}
const a = "10000000-0000-4000-8000-000000000001",
  otherA = "10000000-0000-4000-8000-000000000002";
const c = "20000000-0000-4000-8000-000000000001",
  otherC = "20000000-0000-4000-8000-000000000002";
const owner = "30000000-0000-4000-8000-000000000001";
const student = "40000000-0000-4000-8000-000000000001",
  otherStudent = "40000000-0000-4000-8000-000000000002";
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
  await db.exec(fixture);
  for (const t of [
    "homework_assignments",
    "homework_attempts",
    "homework_answers",
  ])
    await db.exec(table(sql40, t));
  await db.exec(`alter table homework_assignments add column kind text default 'class',add column group_id uuid,add column recommendation jsonb,add column target_count int default 0;
 alter table homework_answers add column item_id uuid;
 alter table homework_answers drop constraint homework_answers_attempt_id_q_index_key;
 create unique index answer_item_unique on homework_answers(attempt_id,item_id,q_index);
 create table homework_assignment_targets(assignment_id uuid,student_id uuid,token_expires_at timestamptz,primary key(assignment_id,student_id));`);
  for (const t of [
    "homework_items",
    "homework_item_attempts",
    "learning_events",
  ])
    await db.exec(table(sql41, t));
  for (const name of [
    "hw_norm",
    "hw_grade",
    "hw_answer_text",
    "hw_public_item",
    "hw_staff_academy",
    "hw_state",
    "hw_submit",
    "hw_progress",
    "hw_finish",
    "hw_create_v2",
  ])
    await db.exec(fn(sql41, name));
  // Latest feature-aware attempt resolver uses $fn$ delimiters.
  const guard = readFileSync(
    resolve(sqlRoot, "074c_feature_guards.sql"),
    "utf8",
  );
  await db.exec(
    guard.slice(
      guard.indexOf("create or replace function public.hw_attempt_for"),
    ),
  );
  await db.exec(
    readFileSync(resolve(sqlRoot, "087_homework_blocks.sql"), "utf8"),
  );
  await db.exec(
    `insert into academies(id) values('${a}'),('${otherA}');insert into classes values('${c}','${a}'),('${otherC}','${otherA}');insert into auth.users values('${owner}');insert into students(id,academy_id,class_id,name) values('${student}','${a}','${c}','Synthetic A'),('${otherStudent}','${otherA}','${otherC}','Synthetic B');set "test.user"='${owner}';set test.academy='${a}';`,
  );
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
