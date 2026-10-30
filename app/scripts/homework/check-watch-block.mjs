// 영상 반복 보기 블록(094) + 시청 기록(093) 검사 — check-blocks.mjs 와 같은 합성 DB(PGlite)에 040/041/074c/087 을 올린 뒤
// 093a~e, 094a~b 를 적용해 실제로 돌려 본다. 환경 파일·네트워크·운영 DB 는 읽지 않는다.
// 실행: node scripts/homework/check-watch-block.mjs   (app/ 에서, 테스트 도구는 check-blocks.mjs 와 같은 곳)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { PGlite } from "../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sqlRoot = resolve(app, "../supabase");
const read = (f) => readFileSync(resolve(sqlRoot, f), "utf8");
const sql41 = read("041_homework_v2.sql");
const sql40 = read("040_homework.sql");
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
const a = "10000000-0000-4000-8000-000000000001";
const c = "20000000-0000-4000-8000-000000000001";
const owner = "30000000-0000-4000-8000-000000000001";
const s1 = "40000000-0000-4000-8000-000000000001";
const s2 = "40000000-0000-4000-8000-000000000002";
const q = (s) => `'${s.replaceAll("'", "''")}'`;
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;
const value = async (query) => (await db.query(query)).rows[0]?.v;
const rejects = (query, pattern) => assert.rejects(db.query(query), pattern);
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
        if (id.replaceAll("\\", "/").endsWith("/src/lib/supabase.ts")) return "export const supabase = {};";
      },
    },
  ],
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
});
try {
  await db.exec(fixture);
  for (const t of ["homework_assignments", "homework_attempts", "homework_answers"]) await db.exec(table(sql40, t));
  await db.exec(`alter table homework_assignments add column kind text default 'class',add column group_id uuid,add column recommendation jsonb,add column target_count int default 0;
 alter table homework_answers add column item_id uuid;
 alter table homework_answers drop constraint homework_answers_attempt_id_q_index_key;
 create unique index answer_item_unique on homework_answers(attempt_id,item_id,q_index);
 create table homework_assignment_targets(assignment_id uuid,student_id uuid,token_expires_at timestamptz,primary key(assignment_id,student_id));`);
  for (const t of ["homework_items", "homework_item_attempts", "learning_events"]) await db.exec(table(sql41, t));
  for (const name of ["hw_norm", "hw_grade", "hw_answer_text", "hw_public_item", "hw_staff_academy", "hw_state", "hw_submit", "hw_progress", "hw_finish", "hw_create_v2"])
    await db.exec(fn(sql41, name));
  const guard = read("074c_feature_guards.sql");
  await db.exec(guard.slice(guard.indexOf("create or replace function public.hw_attempt_for")));
  await db.exec(read("087_homework_blocks.sql"));
  for (const f of ["093a_watch_tables.sql", "093b_watch_report.sql", "093c_watch_state.sql", "093d_watch_summary.sql", "093e_watch_grants.sql", "094a_watch_block_validate.sql", "094b_watch_progress_guard.sql"])
    await db.exec(read(f)).catch((e) => {
      throw new Error(`${f}: ${e.message}`);
    });
  await db.exec(
    `insert into academies(id) values('${a}');insert into classes values('${c}','${a}');insert into auth.users values('${owner}');insert into students(id,academy_id,class_id,name) values('${s1}','${a}','${c}','학생1'),('${s2}','${a}','${c}','학생2');set "test.user"='${owner}';set test.academy='${a}';`,
  );
  const blocks = await vite.ssrLoadModule("/src/lib/homework/blocks.ts");
  const watch = (views, url = "https://youtu.be/abcdefghijk") => {
    const it = blocks.newBlock("watch");
    it.config.block.videoUrl = url;
    it.config.block.views = views;
    return blocks.syncWatchItem(it);
  };

  await test("client: watch 블록은 학생 화면이 읽는 모양(watch·kids·targetViews·videoId)으로 맞춰진다", () => {
    const it = watch(3);
    assert.equal(it.config.watch, true);
    assert.equal(it.config.kids, true);
    assert.equal(it.config.targetViews, 3);
    assert.equal(it.content.videoId, "abcdefghijk");
    assert.equal(it.kind, "shadowing");
    assert.deepEqual(it.content.questions, []);
    assert.equal(blocks.syncWatchItem(it).config.targetViews, 3, "다시 맞춰도 같다");
  });
  await test("client: 영상 주소가 없거나 횟수가 범위를 벗어나면 검사에서 걸린다", () => {
    assert.deepEqual(blocks.validateItems([watch(2)]), []);
    assert(blocks.validateItems([watch(2, "")]).some((e) => /YouTube/.test(e)));
    const bad = watch(2);
    bad.config.block.views = 9;
    assert(blocks.validateItems([bad]).some((e) => /1~5/.test(e)));
  });
  await test("server: watch 블록을 허용하고 잘못된 모양은 거절한다", async () => {
    await db.query(`select hw_validate_items(${json([watch(2)])})`);
    const badViews = watch(2);
    badViews.config.block.views = 6;
    await rejects(`select hw_validate_items(${json([badViews])})`, /bad_views/);
    const badDone = watch(2);
    badDone.config.block.completion = "review";
    await rejects(`select hw_validate_items(${json([badDone])})`, /bad_completion/);
    await rejects(`select hw_validate_items(${json([watch(2, "https://example.com/x")])})`, /bad_video/);
    const ghost = watch(2);
    ghost.config.block.type = "ghost";
    await rejects(`select hw_validate_items(${json([ghost])})`, /unsupported_block/);
  });
  await test("server: 087 의 기존 5종 블록 검증은 그대로 통과한다", async () => {
    const five = ["study", "recall", "speak", "sentence", "video"].map((type) => (type === "recall" ? blocks.blocksFromCards([{ id: "c", word: "cat", meaning: "고양이", example: "I like cats." }, { id: "d", word: "dog", meaning: "개", example: "I like dogs." }], type)[0] : blocks.newBlock(type)));
    five.forEach((it) => (it.config.block.text = "I like cats."));
    Object.assign(five[4].config.block, { videoUrl: "https://youtu.be/abcdefghijk", start: 3, end: 9 });
    await db.query(`select hw_validate_items(${json(five)})`);
  });

  let assignment;
  let items;
  await test("배정: watch 블록이 든 숙제가 만들어지고 항목은 학생 화면용 모양으로 저장된다", async () => {
    const draft = { ...blocks.newDraft(), title: "영상 2번", items: [watch(2)] };
    assignment = await value(`select hw_assign_draft('${c}',${json(draft)},null,null,'${crypto.randomUUID()}') v`);
    items = (await db.query(`select id, config from homework_items where assignment_id='${assignment.id}'`)).rows;
    assert.equal(items.length, 1);
    assert.equal(items[0].config.watch, true);
    assert.equal(items[0].config.targetViews, 2);
  });
  const attempt = async (student) =>
    (await value(`insert into homework_attempts(assignment_id,student_id) values('${assignment.id}','${student}') returning token v`));
  const report = async (token, view, dur, watched) =>
    value(`select hw_watch_report('${token}','${items[0].id}','${view}',${dur},${watched}) v`);
  const age = (view) => db.query(`update homework_watch_views set started_at = now() - interval '300 seconds' where view_key='${view}'`);
  const complete = (token) => db.query(`select hw_progress('${token}','${items[0].id}','item_complete','{}'::jsonb,'${crypto.randomUUID()}')`);

  await test("서버가 막는다: 시청 기록이 있으면 목표 횟수를 다 채워야 활동이 끝난다", async () => {
    const t1 = await attempt(s1);
    const v1 = crypto.randomUUID();
    const v2 = crypto.randomUUID();
    let r = await report(t1, v1, 100, 100);
    assert.equal(r.completed, false, "방금 시작했는데 100초를 봤다고 해도 인정 안 됨");
    await age(v1);
    r = await report(t1, v1, 100, 100);
    assert.equal(r.completed, true);
    assert.equal(r.views, 1);
    await rejects(`select hw_progress('${t1}','${items[0].id}','item_complete','{}'::jsonb,'${crypto.randomUUID()}')`, /incomplete/);
    await report(t1, v2, 100, 100);
    await age(v2);
    r = await report(t1, v2, 100, 100);
    assert.equal(r.views, 2);
    await complete(t1);
    assert.notEqual(await value(`select finished_at v from homework_item_attempts where item_id='${items[0].id}' and attempt_id=(select id from homework_attempts where token='${t1}')`), null);
  });
  await test("시청 기록이 하나도 없으면(오프라인·옛 앱) 예전처럼 끝낼 수 있다", async () => {
    const t2 = await attempt(s2);
    await complete(t2);
  });
  await test("학생 상태·선생님 현황에 횟수와 날짜가 보인다", async () => {
    const t1 = await value(`select token v from homework_attempts where student_id='${s1}'`);
    const st = await value(`select hw_watch_state('${t1}') v`);
    assert.equal(st[0].target, 2);
    assert.equal(st[0].days.length, 2);
    const sum = await value(`select hw_watch_summary('${assignment.id}') v`);
    const mine = sum.find((x) => x.name === "학생1");
    assert.equal(mine.views, 2);
    assert.equal(sum.find((x) => x.name === "학생2").views, 0);
  });
  const cards = ["apple", "banana", "cat", "dog", "egg", "fish", "goat"].map((w, i) => ({ id: `w${i}`, word: w, meaning: `뜻${i}`, example: `I see a ${w}.` }));
  await test("혼자 하는 게임 3종이 문제와 정답을 갖고 서버 검증을 통과한다", async () => {
    for (const g of ["matchup", "anagram", "spelling"]) {
      const it = blocks.gameItemFromCards(cards, g, g);
      assert(it, g);
      assert.equal(it.kind, "game");
      assert.equal(it.config.game, g);
      assert(it.content.questions.length >= 2, g);
      await db.query(`select hw_validate_items(${json([it])})`);
    }
  });
  await test("재료가 모자라거나 영어 글자가 아니면 게임을 만들지 않는다", () => {
    assert.equal(blocks.gameItemFromCards([cards[0]], "matchup", "x"), null);
    assert.equal(blocks.gameItemFromCards([{ id: "k", word: "사과", meaning: "apple" }], "anagram", "x"), null);
    assert.equal(blocks.gameItemFromCards([], "spelling", "x"), null);
  });
  await test("추천 활동을 블록으로 감싸면 편집 가능한 recall 블록이 되고 문제·게임·영상은 그대로다", async () => {
    const quiz = { kind: "quiz", title: "단어 퀴즈", config: {}, content: { questions: blocks.blocksFromCards(cards, "recall")[0].content.questions } };
    const game = blocks.gameItemFromCards(cards, "matchup", "짝 맞추기");
    const wrapped = blocks.quizItemsToBlocks([quiz, game, watch(2)]);
    assert.equal(wrapped[0].config.block.type, "recall");
    assert.equal(wrapped[0].config.block.completion, "answers");
    assert.deepEqual(wrapped[0].content.questions, quiz.content.questions);
    assert.equal(wrapped[1].config.block, undefined, "게임은 감싸지 않는다");
    assert.equal(wrapped[2].config.block.type, "watch");
    assert.deepEqual(blocks.validateItems(wrapped), []);
    await db.query(`select hw_validate_items(${json(wrapped)})`);
  });
  const slots = await vite.ssrLoadModule("/src/lib/homework/slots.ts");
  const recOf = (labels) => ({
    items: [
      { kind: "quiz", title: "단어 퀴즈", config: {}, content: { questions: blocks.blocksFromCards(labels.map((w, i) => ({ id: `x${i}`, word: w, meaning: `뜻${w}`, example: "" })), "recall")[0].content.questions } },
      blocks.gameItemFromCards(labels.map((w, i) => ({ id: `g${i}`, word: w, meaning: `뜻${w}`, example: "" })), "anagram", "글자 섞기"),
    ],
  });
  await test("맞춤 칸: 학생마다 다른 추천으로 채워지고 공통 활동은 그대로 간다", () => {
    const tpl = [watch(1), slots.newSlot("quiz"), slots.newSlot("game")];
    assert(slots.hasSlots(tpl));
    const a = slots.expandSlots(tpl, recOf(["apple", "banana", "cat", "dog", "egg", "fish"]));
    const b = slots.expandSlots(tpl, recOf(["goat", "hen", "ice", "jam", "kite", "lamp"]));
    assert.equal(a.empty, 0);
    assert.equal(a.items.length, 3);
    assert.equal(a.items[0].config.block.type, "watch", "공통 블록은 그대로");
    assert(!slots.hasSlots(a.items), "채워진 숙제에는 칸이 남지 않는다");
    assert.notDeepEqual(a.items[1].content.questions, b.items[1].content.questions, "학생마다 다른 문제");
    assert(a.items[1].content.questions.length <= 5, "칸의 문제 수 한도");
    assert.equal(a.items[2].config.game, "anagram");
  });
  await test("맞춤 칸: 채울 재료가 없으면 그 칸만 빠지고 개수를 알려 준다", () => {
    const tpl = [slots.newSlot("quiz"), slots.newSlot("game"), watch(1)];
    const r = slots.expandSlots(tpl, { items: [] });
    assert.equal(r.empty, 2);
    assert.equal(r.items.length, 1);
    assert.equal(slots.expandSlots(tpl, null).empty, 2);
  });
  await test("맞춤 칸이 든 초안은 클라이언트 검사를 통과하고 서버 초안 저장도 된다", async () => {
    const tpl = [watch(2), slots.newSlot("quiz")];
    assert.deepEqual(blocks.validateItems(tpl), []);
    const draft = { ...blocks.newDraft(), title: "맞춤 틀", items: tpl };
    const saved = await value(`select hw_save_draft('${c}',${json(draft)}) v`);
    assert.equal(saved.items[1].config.slot.want, "quiz");
    const filled = slots.expandSlots(tpl, recOf(["apple", "banana", "cat", "dog"]));
    await db.query(`select hw_validate_items(${json(filled.items)})`);
  });
  console.log(`\n${passed} passed`);
} finally {
  await vite.close();
}
