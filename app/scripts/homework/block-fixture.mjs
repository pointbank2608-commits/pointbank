import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const app = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sqlRoot = resolve(app, "../supabase");
const sql41 = readFileSync(resolve(sqlRoot, "041_homework_v2.sql"), "utf8");
const sql40 = readFileSync(resolve(sqlRoot, "040_homework.sql"), "utf8");
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
export {app,sqlRoot,fn,table};
export const fixtureIds={a,otherA,c,otherC,owner,student,otherStudent};
export async function installHomeworkFixture(db){
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
  await db.exec(readFileSync(resolve(sqlRoot, "110_guided_homework_feedback.sql"), "utf8"));
  for (const part of ["112a_spelling_hints_tables","112b_spelling_hints_hint_rpc","112c_spelling_hints_public_item","112d_spelling_hints_summary","112e_spelling_hints_results"])
    await db.exec(readFileSync(resolve(sqlRoot, part + ".sql"), "utf8"));
}
