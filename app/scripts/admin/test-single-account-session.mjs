import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const run = (file) => db.exec(readFileSync(new URL(`../../../supabase/${file}`, import.meta.url), 'utf8'));
const value = async (sql, params = []) => (await db.query(sql, params)).rows[0]?.value;
const user = randomUUID();
const anotherUser = randomUUID();
const first = randomUUID();
const second = randomUUID();
const anotherSession = randomUUID();
const admin = randomUUID();
const adminSession = randomUUID();
const academy = randomUUID();
const classroom = randomUUID();
const otherClass = randomUUID();
const student = randomUUID();
const otherStudent = randomUUID();
const preset = randomUUID();

async function as(role, sub, session, aal = 'aal1') {
  await db.exec(`reset role; set role ${role};`);
  await value("select set_config('request.jwt.claims', $1, false) as value", [JSON.stringify({ sub, session_id: session, aal })]);
}

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role authenticator;
    create role service_role;
    create schema auth;
    create schema storage;
    create table auth.users (id uuid primary key, email text);
    create table auth.sessions (id uuid primary key, user_id uuid references auth.users, created_at timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$
      select current_setting('request.jwt.claims', true)::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$
      select (auth.jwt()->>'sub')::uuid
    $$;
    grant usage on schema auth, storage to authenticated;
    create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id uuid primary key, bucket_id text, name text);
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1, '/') $$;
    alter table storage.objects enable row level security;
    grant select on storage.objects to authenticated;
    create policy fixture_read on storage.objects for select to authenticated using (true);
    insert into storage.objects (id) values (gen_random_uuid());
    create publication supabase_realtime;
  `);
  const base = readFileSync(new URL('../../../supabase/schema.sql', import.meta.url), 'utf8');
  await db.exec(base.replace('create extension if not exists pgcrypto;', ''));
  await run('010_homework_tracking.sql');
  await db.exec('alter table public.students add column archived_at timestamptz');
  await run('077a_remote_sessions.sql');
  await db.query("insert into auth.users values ($1, 'teacher@fixture.invalid'), ($2, 'other@fixture.invalid')", [user, anotherUser]);
  await db.query("insert into auth.sessions values ($1, $2, now() - interval '1 hour'), ($3, $4, now())", [first, user, anotherSession, anotherUser]);
  await db.query("insert into academies (id, name) values ($1, 'Test academy')", [academy]);
  await db.query("insert into profiles (id, academy_id, role, display_name) values ($1, $3, 'teacher', 'Teacher'), ($2, $3, 'teacher', 'Other teacher')", [user, anotherUser, academy]);
  await db.query("insert into classes (id, academy_id, name) values ($1, $3, 'Class'), ($2, $3, 'Other class')", [classroom, otherClass, academy]);
  await db.query("insert into students (id, academy_id, class_id, name) values ($1, $3, $4, 'Student'), ($2, $3, $5, 'Other student')", [student, otherStudent, academy, classroom, otherClass]);
  await db.query("insert into presets (id, academy_id, label, delta) values ($1, $2, 'Work', 2)", [preset, academy]);
  await run('121_remote_qr_pairing.sql');
  await run('123_remote_touchpad.sql');
  await run('124_remote_pointer_click.sql');
  await run('125_remote_text_input.sql');
  await run('126_remote_scroll_strip.sql');
  await as('authenticated', user, first);
  const pair = await value('select remote_qr_open($1) as value', [classroom]);
  const textTarget = randomUUID();
  await db.query('update remote_sessions set state = $1 where id = $2', [{
    lessonName: 'Test', ended: false, stepIndex: 0, steps: [{}], actions: [{ id: 'good' }], classId: classroom,
    pointerEnabled: true, pointerClickEnabled: true, scrollEnabled: true, textTarget: { id: textTarget, limit: 12, multiline: false },
  }, pair.id]);

  await as('anon');
  const poll = (key = pair.key) => value('select remote_qr_poll($1, $2) as value', [pair.id, key]);
  const send = (name, arg = null, action = null) =>
    value('select remote_qr_send($1, $2, $3, $4, $5) as value', [pair.id, pair.key, name, arg, action]);
  const give = (request, students) =>
    value('select remote_qr_give($1, $2, $3, $4, $5) as value', [pair.id, pair.key, request, preset, students]);
  const move = (dx, dy, key = pair.key) =>
    value('select remote_qr_move_pointer($1, $2, $3, $4) as value', [pair.id, key, dx, dy]);
  const click = (count, step = 0, key = pair.key) =>
    value('select remote_qr_click_pointer($1, $2, $3, $4) as value', [pair.id, key, count, step]);
  const writeText = (draft, target = textTarget, key = pair.key) =>
    value('select remote_qr_write_text($1, $2, $3, $4) as value', [pair.id, key, target, draft]);
  const scroll = (delta, step = 0, key = pair.key) =>
    value('select remote_qr_scroll($1, $2, $3, $4) as value', [pair.id, key, delta, step]);
  assert.equal(await poll(randomUUID()), null);
  assert.equal((await poll()).state.lessonName, 'Test');
  assert.equal(await send('action', null, 'missing'), false);
  assert.equal(await send('goto', 1), false);
  assert.equal(await send('next'), true);
  assert.equal(await send('action', null, 'good'), true);
  assert.equal(await move(100, -100, randomUUID()), false);
  assert.equal(await move(1001, 0), false);
  assert.equal(await move(null, 1), false);
  assert.equal(await move(0, 0), false);
  assert.equal(await scroll(10), true);
  assert.equal(await click(1), false);
  assert.equal(await move(150, -200), true);
  assert.equal(await click(1, 0, randomUUID()), false);
  assert.equal(await click(1, 1), false);
  assert.equal(await click(3), false);
  assert.equal(await click(1), true);
  assert.equal(await move(500, -500), true);
  assert.equal(await writeText('안녕', textTarget, randomUUID()), false);
  assert.equal(await writeText('안녕', randomUUID()), false);
  assert.equal(await writeText('abcdefghijklmn'), false);
  assert.equal(await writeText('줄\n바꿈'), false);
  assert.equal(await writeText('안녕'), true);
  assert.equal(await writeText('반가워!'), true);
  assert.equal(JSON.stringify(await poll()).includes('반가워!'), false);
  assert.equal(await scroll(140, 0, randomUUID()), false);
  assert.equal(await scroll(140, 1), false);
  assert.equal(await scroll(1001), false);
  assert.equal(await scroll(140), true);
  assert.equal(await scroll(-30), true);
  assert.deepEqual((await value('select remote_qr_points($1, $2) as value', [pair.id, pair.key])).students.map((s) => s.id), [student]);
  await assert.rejects(give(randomUUID(), [student, otherStudent]), /remote_points_unavailable/);
  const request = randomUUID();
  assert.equal(await give(request, [student]), 1);
  assert.equal(await give(request, [student]), 1);
  const points = await value('select remote_qr_points($1, $2) as value', [pair.id, pair.key]);
  assert.equal(points.students[0].today, 2);
  await assert.rejects(value('select remote_qr_open($1) as value', [classroom]), /permission denied/);
  await assert.rejects(value('select pairing_key as value from remote_sessions'), /permission denied/);

  await db.exec('reset role');
  await run('122_single_account_session.sql');
  await as('authenticated', user, first);
  await db.exec('select classbank_check_request()');
  assert.deepEqual(await value('select pointer as value from remote_sessions where id = $1', [pair.id]), {
    seq: 2, x: 1000, y: 0, click: { seq: 1, x: 650, y: 300, count: 1, step: 0 },
  });
  assert.deepEqual(await value('select scroll as value from remote_sessions where id = $1', [pair.id]),
    { seq: 3, step: 0, total: 120 });
  assert.equal(await value("select cmd->>'name' as value from remote_sessions where id = $1", [pair.id]), 'action');
  await db.query('update remote_sessions set text_input = null where id = $1 and text_seq = 1', [pair.id]);
  assert.equal(await value("select text_input->>'draft' as value from remote_sessions where id = $1", [pair.id]), '반가워!');
  await db.query("update remote_sessions set state = state || '{\"stepIndex\":1,\"textTarget\":null}' where id = $1", [pair.id]);
  assert.equal(await value('select text_input as value from remote_sessions where id = $1', [pair.id]), null);
  await as('anon');
  assert.equal(await writeText('이전 칸'), false);
  assert.equal(await scroll(50, 0), false);
  assert.equal(await scroll(50, 1), true);
  await as('authenticated', user, first);
  assert.deepEqual(await value('select scroll as value from remote_sessions where id = $1', [pair.id]),
    { seq: 4, step: 1, total: 50 });
  assert.equal(await value('select count(*)::integer as value from storage.objects'), 1);
  await db.exec('reset role');
  await db.query('insert into auth.sessions values ($1, $2, now())', [second, user]);

  await as('authenticated', user, first);
  await assert.rejects(db.exec('select classbank_check_request()'), { code: 'PT409' });
  assert.equal(await value('select count(*)::integer as value from storage.objects'), 0);
  assert.equal(await value('select count(*)::integer as value from remote_sessions'), 0);
  await as('anon');
  await db.exec('select classbank_check_request()');
  assert.equal(await poll(), null);
  assert.equal(await send('next'), false);
  assert.equal(await move(-100, 100), false);
  assert.equal(await click(2), false);
  assert.equal(await writeText('이전 로그인'), false);
  assert.equal(await scroll(100, 1), false);
  await as('authenticated', user, second);
  await db.exec('select classbank_check_request()');
  await as('authenticated', anotherUser, anotherSession);
  await db.exec('select classbank_check_request()');

  await db.exec('reset role');
  await db.query("insert into auth.sessions values (gen_random_uuid(), $1, now() - interval '1 day')", [user]);
  await db.query('update auth.sessions set created_at = now() where id = $1', [first]);
  await as('authenticated', user, second);
  await db.exec('select classbank_check_request()');
  const newPair = await value('select remote_qr_open($1) as value', [classroom]);
  await db.query("update remote_sessions set state = '{\"ended\": true, \"pointerEnabled\": true}' where id = $1", [newPair.id]);
  await as('anon');
  assert.equal(await value("select remote_qr_send($1, $2, 'next', null, null) as value", [newPair.id, newPair.key]), false);
  assert.equal(await value('select remote_qr_move_pointer($1, $2, 100, -200) as value', [newPair.id, newPair.key]), false);
  await db.exec('reset role');
  await db.query("update remote_sessions set board_seen_at = now() - interval '3 minutes' where id = $1", [newPair.id]);
  await as('anon');
  assert.equal(await value('select remote_qr_poll($1, $2) as value', [newPair.id, newPair.key]), null);
  await db.exec('reset role');
  await db.query('delete from auth.sessions where id = $1', [second]);
  await as('authenticated', user, first);
  await assert.rejects(db.exec('select classbank_check_request()'), { code: 'PT409' });
  await as('authenticated', user, second);
  await assert.rejects(db.exec('select classbank_check_request()'), { code: 'PT409' });
  await db.exec('reset role');
  await run('122_rollback.sql');
  await as('authenticated', user, first);
  await db.exec('select classbank_check_request()');
  await as('anon');
  assert.equal((await poll()).state.lessonName, 'Test');
  await db.exec('reset role');
  await run('122_single_account_session.sql');
  await db.exec(`
    create table public.admin_actions (
      id uuid primary key default gen_random_uuid(),
      admin_id uuid default auth.uid(),
      academy_id uuid references public.academies(id) on delete set null,
      action text not null,
      detail jsonb,
      created_at timestamptz not null default now()
    );
  `);
  await run('086b_admin_settings_and_log.sql');
  await run('082c_enforce_admin_mfa.sql');
  await run('131_admin_account_session_policy.sql');
  await db.query("insert into auth.users values ($1, 'admin@fixture.invalid')", [admin]);
  await db.query("insert into profiles (id, role, display_name) values ($1, 'admin', 'Admin')", [admin]);
  await db.query('insert into auth.sessions values ($1, $2, now()), ($3, $4, now())', [adminSession, admin, second, user]);

  const search = (query) => db.query('select * from admin_search_login_accounts($1)', [query]).then(({ rows }) => rows);
  const setPolicy = (target, allow) => db.query('select admin_set_login_account_policy($1, $2)', [target, allow]);
  for (const claims of [['anon'], ['authenticated', user, second], ['authenticated', admin, adminSession]]) {
    await as(...claims);
    await assert.rejects(search('teacher'), { code: '42501' });
    await assert.rejects(setPolicy(user, true), { code: '42501' });
  }
  await as('authenticated', admin, adminSession, 'aal2');
  await db.exec('select classbank_check_request()');
  assert.deepEqual((await search('TEACHER@FIXTURE.INVALID')).map((row) => [row.user_id, row.allow_multiple]), [[user, false]]);
  assert.equal((await search('Other teacher'))[0].user_id, anotherUser);
  await setPolicy(user, true);
  await setPolicy(user, true);
  assert.equal((await search('teacher@fixture.invalid'))[0].allow_multiple, true);

  const anotherLatest = randomUUID();
  await db.exec('reset role');
  await db.query('insert into auth.sessions values ($1, $2, now())', [anotherLatest, anotherUser]);
  await as('authenticated', anotherUser, anotherSession);
  await assert.rejects(db.exec('select classbank_check_request()'), { code: 'PT409' });
  await as('authenticated', anotherUser, anotherLatest);
  await db.exec('select classbank_check_request()');

  for (const session of [first, second]) {
    await as('authenticated', user, session);
    await db.exec('select classbank_check_request()');
    assert.equal(await value('select count(*)::integer as value from storage.objects'), 1);
  }
  await as('authenticated', user, anotherSession);
  await assert.rejects(db.exec('select classbank_check_request()'), { code: 'PT409' });
  await as('anon');
  assert.equal((await poll()).state.lessonName, 'Test');
  await as('authenticated', admin, adminSession, 'aal2');
  assert.equal((await search('Other teacher'))[0].allow_multiple, false);
  await setPolicy(user, false);
  assert.equal((await search('teacher@fixture.invalid'))[0].allow_multiple, false);
  const { rows: actions } = await db.query(`
    select b.before, b.after, b.actor_email from admin_action_log($1, 10, 0) b
    where b.action = 'set_login_account_policy'
    order by (b.after->>'allow_multiple')::boolean desc`, [academy]);
  assert.deepEqual(actions.map(({ before, after, actor_email }) => [before.allow_multiple, after.allow_multiple, actor_email]),
    [[false, true, 'admin@fixture.invalid'], [true, false, 'admin@fixture.invalid']]);

  await as('authenticated', user, first);
  await assert.rejects(db.exec('select classbank_check_request()'), { code: 'PT409' });
  await as('authenticated', user, second);
  await db.exec('select classbank_check_request()');
  await as('anon');
  assert.equal(await poll(), null);

  await db.exec('reset role');
  await run('132_admin_academy_login_policy.sql');
  const separateAcademy = randomUUID();
  const outsideOwner = randomUUID();
  const outsideOlder = randomUUID();
  const outsideLatest = randomUUID();
  await db.query("insert into academies (id, name) values ($1, 'Separate academy')", [separateAcademy]);
  await db.query("insert into auth.users values ($1, 'owner@fixture.invalid')", [outsideOwner]);
  await db.query("insert into profiles (id, academy_id, role, display_name) values ($1, $2, 'owner', 'Outside owner')", [outsideOwner, separateAcademy]);
  await db.query("insert into auth.sessions values ($1, $3, now() - interval '1 hour'), ($2, $3, now())", [outsideOlder, outsideLatest, outsideOwner]);
  await db.exec('grant select, update on public.profiles to authenticated');
  const academyPolicy = (id = academy) => value('select admin_academy_login_policy($1) as value', [id]);
  const setAcademyPolicy = (allow) => value('select admin_set_academy_login_policy($1, $2) as value', [academy, allow]);

  await as('authenticated', user, second);
  await assert.rejects(academyPolicy(), { code: '42501' });
  await assert.rejects(setAcademyPolicy(true), { code: '42501' });
  await assert.rejects(db.query('update profiles set academy_id = $1 where id = $2', [separateAcademy, user]), { code: '42501' });
  await assert.rejects(db.query("update profiles set role = 'owner' where id = $1", [user]), { code: '42501' });
  await db.query("update profiles set display_name = 'Teacher updated' where id = $1", [user]);

  await as('authenticated', admin, adminSession, 'aal2');
  assert.equal(await academyPolicy(), 'blocked');
  await setPolicy(user, true);
  assert.equal(await academyPolicy(), 'mixed');
  assert.equal(await setAcademyPolicy(true), 'allowed');
  assert.equal(await academyPolicy(separateAcademy), 'blocked');

  for (const [accountId, sessionId] of [[user, first], [user, second], [anotherUser, anotherSession], [anotherUser, anotherLatest]]) {
    await as('authenticated', accountId, sessionId);
    await db.exec('select classbank_check_request()');
  }
  await as('authenticated', outsideOwner, outsideOlder);
  await assert.rejects(db.exec('select classbank_check_request()'), { code: 'PT409' });

  await db.exec('reset role');
  await db.query('update profiles set academy_id = $1 where id = $2', [academy, outsideOwner]);
  await as('authenticated', outsideOwner, outsideOlder);
  await db.exec('select classbank_check_request()');
  await as('authenticated', admin, adminSession, 'aal2');
  assert.equal(await setAcademyPolicy(false), 'blocked');
  assert.equal(await setAcademyPolicy(false), 'blocked');
  assert.equal((await search('teacher@fixture.invalid'))[0].allow_multiple, true);
  const { rows: academyActions } = await db.query(`
    select b.before->>'policy' as previous, b.after->>'policy' as next
    from admin_action_log($1, 10, 0) b where b.action = 'set_academy_login_policy'
    order by next`, [academy]);
  assert.deepEqual(academyActions, [{ previous: 'mixed', next: 'allowed' }, { previous: 'allowed', next: 'blocked' }]);

  for (const [accountId, older, latest] of [[user, first, second], [anotherUser, anotherSession, anotherLatest], [outsideOwner, outsideOlder, outsideLatest]]) {
    await as('authenticated', accountId, older);
    await assert.rejects(db.exec('select classbank_check_request()'), { code: 'PT409' });
    await as('authenticated', accountId, latest);
    await db.exec('select classbank_check_request()');
  }
  console.log('Account and academy session policies and QR remote checks passed');
} catch (error) {
  console.error(error.message, error.code ?? '', error.where ?? '');
  process.exitCode = 1;
} finally {
  await db.close();
}
