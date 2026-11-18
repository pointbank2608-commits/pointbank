import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const modules = process.env.PARENT_TEST_NODE_MODULES
  ? pathToFileURL(resolve(process.env.PARENT_TEST_NODE_MODULES) + '/')
  : new URL('../../node_modules/homework-test-tools/node_modules/', import.meta.url);
const { PGlite } = await import(new URL('@electric-sql/pglite/dist/index.js', modules));
const { pgcrypto } = await import(new URL('@electric-sql/pglite/dist/contrib/pgcrypto.js', modules));

const db = new PGlite({ extensions: { pgcrypto } });
const migration = readFileSync(new URL('../../../supabase/133_parent_portal.sql', import.meta.url), 'utf8');
const [academy, academy2, child, other, assignment, second, lesson, solo, plan, grammar, words, target] =
  Array.from({ length: 12 }, () => crypto.randomUUID());
const endpoint = 'https://web.push.apple.com/synthetic';
const val = async (sql, args) => (await db.query(sql, args)).rows[0]?.value;
const home = (token) => val('select parent_home($1,$2) value', [token, endpoint]);

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema extensions; create extension pgcrypto with schema extensions;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create table private_config(key text primary key, value text not null);
    insert into private_config values ('guardian_phone_key','synthetic-encryption-key');
    insert into private_config values ('parent_push_public_key','synthetic-public-push-key');
    create table academies(id uuid primary key,name text);
    create table students(id uuid primary key,academy_id uuid,name text,archived_at timestamptz);
    create table student_guardian(student_id uuid primary key,phone_hash text,phone_last4 text,phone_enc bytea,
      consent_at timestamptz,consent_by uuid,updated_at timestamptz);
    create table student_sessions(student_id uuid);
    create table homework_assignments(id uuid primary key,academy_id uuid,title text,due_at timestamptz,closed_at timestamptz);
    create table homework_assignment_targets(assignment_id uuid,student_id uuid,access_token text,
      created_at timestamptz default now(),token_expires_at timestamptz,primary key(assignment_id,student_id));
    create table homework_attempts(assignment_id uuid,student_id uuid,token uuid default gen_random_uuid(),
      started_at timestamptz default now(),finished_at timestamptz,primary key(assignment_id,student_id));
    create table solo_lessons(id uuid,academy_id uuid,name text);
    create table solo_assignments(id uuid,student_id uuid,academy_id uuid,lesson_id uuid,kind text,
      assigned_at timestamptz default now(),due_at timestamptz,started_at timestamptz,finished_at timestamptz,progress int default 0);
    create table grammar_content_versions(goal_id text,version int,content jsonb);
    create table grammar_plans(id uuid,academy_id uuid,goal_id text,version int,mode text,approved_at timestamptz default now(),initial_due_at timestamptz);
    create table grammar_assignments(id uuid,plan_id uuid,student_id uuid,run_id uuid,initial_completed_at timestamptz,finished_at timestamptz,revoked_at timestamptz);
    create table wm_plans(id uuid,academy_id uuid,title text,closed_at timestamptz,start_date date default current_date,study_days int default 14,review_days int default 14);
    create table wm_targets(id uuid,plan_id uuid,student_id uuid,created_at timestamptz default now());
    create function my_academy_id() returns uuid language sql as $$select nullif(current_setting('test.academy',true),'')::uuid$$;
    create function is_owner() returns boolean language sql as $$select current_setting('test.owner',true)='yes'$$;
    create function is_staff() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
    create function sp_phone_digits(text) returns text language sql as $$select regexp_replace($1,'[^0-9]','','g')$$;
    create function sp_name_key(text) returns text language sql as $$select lower(btrim($1))$$;
    create function academy_feature(uuid,text) returns boolean language sql as $$select true$$;
    create function grammar_feature_open(uuid,text) returns boolean language sql as $$select true$$;
    create function wm_today() returns date language sql as $$select current_date$$;
  `);
  await db.exec(migration);
  await db.exec(readFileSync(new URL('../../../supabase/134_student_account_staff_creation.sql', import.meta.url), 'utf8'));
  const checks = readFileSync(new URL('../../../supabase/133_parent_portal_check.sql', import.meta.url), 'utf8');
  assert.ok(Object.values((await db.query(checks)).rows[0]).every(Boolean));
  await db.query("insert into academies values($1,'학원'),($2,'다른 학원')", [academy, academy2]);
  await db.query("insert into students values($1,$2,'민서',null),($3,$4,'지우',null)", [child, academy, other, academy2]);
  const register = (student, name, phone, consent = true) => db.query('select parent_save_account($1,$2,$3,$4)', [student, name, phone, consent]);
  const studentPhone = (student, phone, consent = true) => db.query('select student_guardian_set($1,$2,$3)', [student, phone, consent]);
  await db.exec(`set test.academy='${academy}'; set test.owner='no'; set test.staff='no'; set role authenticated`);
  await assert.rejects(val('select parent_make_invite($1) value', [child]), /not_found/);
  await assert.rejects(register(child, '보호자', '01098765432'), /not_found/);
  await assert.rejects(studentPhone(child,'01012345678'), /not_staff/);
  await db.exec("set test.staff='yes'");
  await assert.rejects(studentPhone(other,'01012345678'), /not_found/);
  await assert.rejects(studentPhone(child,'01012345678',false), /consent_required/);
  await studentPhone(child,'01012345678');
  await assert.rejects(studentPhone(child,'01098765432'), /not_owner/);
  await db.exec("set test.owner='yes'");
  await studentPhone(child,'01098765432');
  await db.exec("set test.owner='no'");
  await assert.rejects(val('select parent_make_invite($1) value', [other]), /not_found/);
  await assert.rejects(val('select parent_make_invite($1) value', [child]), /parent_account_required/);
  await assert.rejects(register(other,'다른 학부모','01012345678'), /not_found/);
  await assert.rejects(register(child,'김보호','01012345678',false), /consent_required/);
  await assert.rejects(db.query('select * from parent_accounts'), /permission denied/);
  await register(child,'김보호','010-1234-5678');
  assert.deepEqual(await val('select parent_account_status($1) value', [child]), { name: '김보호', last4: '5678' });
  const invite = await val('select parent_make_invite($1) value', [child]);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from parent_sessions'), /permission denied/);
  await assert.rejects(db.query('select * from parent_homework_rows'), /permission denied/);
  await assert.rejects(db.query('select * from parent_claim_push()'), /permission denied/);
  const connection = await val('select parent_connect($1) value', [invite]);
  assert.equal(connection.student_id, child);
  assert.deepEqual(await val('select parent_connect($1) value', [invite]), { error: 'invalid_invite' });
  assert.deepEqual(await home(crypto.randomUUID()), { error: 'expired' });
  assert.deepEqual((await home(connection.token)).homework, []);
  assert.equal((await home(connection.token)).push_key, 'synthetic-public-push-key');
  const setPush = (url, enable = true) => val('select parent_set_push($1,$2,$3,$4,$5) value',
    [connection.token, url, enable, 'a'.repeat(87), 'a'.repeat(22)]);
  assert.deepEqual(await setPush('https://example.com/ssrf'), { error: 'bad_subscription' });
  assert.deepEqual(await setPush(endpoint), { enabled: true });
  assert.equal((await home(connection.token)).push_enabled, true);

  await db.exec('reset role');
  await db.query("insert into homework_assignments values($1,$2,'철자 숙제',now()+interval '1 day',null),($3,$4,'다른 학생 숙제',null,null)", [assignment, academy, second, academy2]);
  await db.query("insert into homework_assignment_targets(assignment_id,student_id,access_token) values($1,$2,'student-secret'),($3,$4,'another-secret'),($3,$2,'bad-cross-academy-target')", [assignment, child, second, other]);
  await db.query('insert into homework_attempts(assignment_id,student_id) values($1,$2)', [assignment, child]);
  assert.equal((await home(connection.token)).homework[0].status, 'started');
  await db.query('update homework_attempts set finished_at=now() where assignment_id=$1', [assignment]);
  await db.query('update homework_attempts set finished_at=now() where assignment_id=$1', [assignment]);
  await db.query("insert into solo_lessons values ($1,$2,'개별 숙제')", [lesson, academy]);
  await db.query("insert into solo_assignments(id,student_id,academy_id,lesson_id,kind) values($1,$2,$3,$4,'homework'),(gen_random_uuid(),$2,$3,$4,'lesson')", [solo,child,academy,lesson]);
  await db.query('update solo_assignments set finished_at=now() where id=$1', [solo]);
  await db.exec(`insert into grammar_content_versions values ('goal',1,'{"title":"문법 숙제"}')`);
  await db.query("insert into grammar_plans(id,academy_id,goal_id,version,mode) values($1,$2,'goal',1,'homework')", [plan,academy]);
  await db.query('insert into grammar_assignments(id,plan_id,student_id) values($1,$2,$3)', [grammar,plan,child]);
  await db.query('update grammar_assignments set initial_completed_at=now() where id=$1', [grammar]);
  assert.equal((await home(connection.token)).homework.find((r) => r.source === 'grammar').status, 'review');
  await db.query('update grammar_assignments set finished_at=now() where id=$1', [grammar]);
  await db.query("insert into wm_plans(id,academy_id,title) values($1,$2,'단어암기')", [words,academy]);
  await db.query('insert into wm_targets(id,plan_id,student_id) values($1,$2,$3)', [target,words,child]);
  const snapshot = await home(connection.token);
  assert.equal(snapshot.homework.length, 4);
  assert.equal(snapshot.homework.filter((r) => r.status === 'completed').length, 3);
  assert.equal(snapshot.homework.find((r) => r.source === 'words').status, 'untracked');
  assert.ok(!JSON.stringify(snapshot).includes('secret'));
  assert.ok(!JSON.stringify(snapshot).includes('다른 학생'));
  await db.query('select parent_read($1,$2)', [connection.token,snapshot.snapshot]);
  assert.equal((await home(connection.token)).read_through, snapshot.snapshot);

  await db.exec('set role service_role');
  const batch = (await db.query('select * from parent_claim_push()')).rows;
  assert.deepEqual(batch.map((job) => job.event).sort(), ['completed','completed','completed','published','published','published','published']);
  assert.ok(batch.every((job) => job.session_id === connection.id && job.endpoint === endpoint));
  assert.equal((await db.query('select * from parent_claim_push()')).rows.length, 0);
  await db.query("select parent_finish_push($1,$2,'sent')", [batch[0].id,batch[0].tries]);
  await db.query("select parent_finish_push($1,$2,'gone')", [batch[1].id,batch[1].tries]);
  await db.exec('set role authenticated');
  assert.equal((await home(connection.token)).push_enabled, false);
  await register(child,'김보호','01012345678');
  assert.equal((await home(connection.token)).name, '민서');
  const oldInvite = await val('select parent_make_invite($1) value', [child]);
  await register(child,'박보호','01012345670');
  assert.deepEqual(await home(connection.token), { error: 'expired' });
  assert.deepEqual(await val('select parent_connect($1) value', [oldInvite]), { error: 'invalid_invite' });
  const removalInvite = await val('select parent_make_invite($1) value', [child]);
  const secondConnection = await val('select parent_connect($1) value',[removalInvite]);
  await db.query('select parent_remove_account($1)', [child]);
  assert.deepEqual(await home(secondConnection.token), { error: 'expired' });
  assert.equal(await val('select parent_account_status($1) value', [child]), null);
  await db.query('select parent_disconnect($1)', [child]);
  assert.deepEqual(await home(connection.token), { error: 'expired' });
  console.log('PASS: student/parent registration, role and academy isolation, one-time access, push deduplication and revocation.');
} finally {
  await db.close();
}
