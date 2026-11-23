import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeDb, as, SUPABASE_DIR } from './lib.mjs';

const db = await makeDb([]);
const admin = '10000000-0000-4000-8000-000000000001';
const teacher = '10000000-0000-4000-8000-000000000002';
try {
  await db.exec(`create table auth.audit_log_entries (id uuid default gen_random_uuid(), created_at timestamptz, payload json);
    insert into auth.users (id) values ('${admin}'), ('${teacher}');
    insert into public.profiles (id,role,display_name) values ('${admin}','admin','Admin'),('${teacher}','teacher','Teacher');
    insert into auth.audit_log_entries (created_at,payload) values
      (now()-interval '1 minute','{"action":"login","actor_id":"${teacher}","actor_username":"test@example.test"}'),
      (now(),' {"action":"logout","actor_id":"${teacher}"}'),
      (now(),' {"action":"token_refreshed","actor_id":"${teacher}"}');`);
  await db.exec(readFileSync(join(SUPABASE_DIR, '138_admin_auth_activity.sql'),'utf8'));
  await db.exec(readFileSync(join(SUPABASE_DIR, '139_admin_password_login.sql'),'utf8'));
  await as(db, teacher);
  assert.equal((await db.query('select public.is_platform_admin() allowed')).rows[0].allowed, false);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from public.admin_auth_activity()'), /admin_required/);
  await as(db, admin);
  assert.equal((await db.query('select public.is_platform_admin() allowed')).rows[0].allowed, true);
  const rows=(await db.query('select * from public.admin_auth_activity()')).rows;
  assert.deepEqual(rows.map(row=>row.event), ['logout','login']);
  assert.equal(rows[0].account,'Teacher');
  assert.equal(rows[1].account,'test@example.test');
  assert.equal((await db.query('select * from public.admin_auth_activity(1)')).rows.length,0);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select * from public.admin_auth_activity()'),/permission denied/);
  console.log('Admin authentication checks passed');
} finally { await db.close(); }
