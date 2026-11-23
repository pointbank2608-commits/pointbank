import assert from 'node:assert/strict';
import { as, makeDb } from './lib.mjs';

const db = await makeDb(['130_admin_ai.sql']);
const admin = '10000000-0000-4000-8000-000000000001';
const teacher = '10000000-0000-4000-8000-000000000002';
const ticket = '10000000-0000-4000-8000-000000000003';
const first = '10000000-0000-4000-8000-000000000004';
const followup = '10000000-0000-4000-8000-000000000005';
const answer = '10000000-0000-4000-8000-000000000006';

try {
  await db.exec(`alter role service_role bypassrls;
    insert into auth.users (id) values ('${admin}'), ('${teacher}');
    insert into public.profiles (id, role, display_name) values ('${admin}', 'admin', 'Admin'), ('${teacher}', 'teacher', 'Teacher');
    insert into public.client_errors (fingerprint, message, user_id) values
      ('test', 'Module missing', '${teacher}'), ('test', 'Module missing again', '${teacher}');
    insert into public.support_tickets (id, user_id, subject) values ('${ticket}', '${teacher}', 'Question');
    insert into public.support_messages (id, ticket_id, sender, body)
      values ('${first}', '${ticket}', 'user', 'Can I print this lesson?');
  `);

  await as(db, teacher);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select * from public.admin_ai_jobs')).rows.length, 0);
  await assert.rejects(db.query('select * from public.admin_ai_claim()'), /permission denied/);
  await as(db, admin);
  assert.equal((await db.query('select * from public.admin_ai_jobs')).rows.length, 2);
  await assert.rejects(db.query("update public.admin_ai_jobs set state = 'ready'"), /permission denied/);

  await db.exec('reset role; set role service_role');
  const claimed = (await db.query('select kind, revision, attempts from public.admin_ai_claim()')).rows;
  assert.equal(claimed.length, 2);
  assert.equal(claimed.find((job) => job.kind === 'ticket').revision, first);
  assert.equal(claimed[0].attempts, 1);
  assert.equal((await db.query('select * from public.admin_ai_claim()')).rows.length, 0);
  const [[context]] = (await db.query("select public.admin_ai_error_context('test')", [], { rowMode: 'array' })).rows;
  assert.equal(context.events, 2);
  assert.equal(context.users, 1);
  assert(!('user_id' in context));

  await db.query("update public.admin_ai_jobs set state = 'ready', result = '{\"draft\":\"Test draft\"}' where kind = 'ticket'");
  await db.exec('reset role');
  assert.equal((await db.query('select id from public.support_messages')).rows.length, 1);
  await db.exec(`insert into public.support_messages (id, ticket_id, sender, body)
    values ('${followup}', '${ticket}', 'user', 'I meant a dedicated worksheet');`);
  const current = (await db.query("select revision,state,result from public.admin_ai_jobs where kind = 'ticket'")).rows[0];
  assert.deepEqual(current, { revision: followup, state: 'pending', result: null });
  await db.exec(`insert into public.support_messages (id, ticket_id, sender, body)
    values ('${answer}', '${ticket}', 'admin', 'This is a human-approved reply');`);
  const answered = (await db.query("select revision,state,result from public.admin_ai_jobs where kind = 'ticket'")).rows[0];
  assert.deepEqual(answered, { revision: answer, state: 'skipped', result: null });
  await db.exec(`delete from public.support_tickets where id = '${ticket}'`);
  assert.equal((await db.query("select * from public.admin_ai_jobs where kind = 'ticket'")).rows.length, 0);
  console.log('Admin AI database checks passed');
} finally {
  await db.close();
}
