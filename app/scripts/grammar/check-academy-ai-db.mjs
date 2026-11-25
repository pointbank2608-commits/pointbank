import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.PGLITE_MODULE ||
  '../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js');
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.academy_scan_access (academy_id int primary key, enabled boolean);
    create table public.client_errors (
      id int primary key, fingerprint text, academy_id int, user_id int, message text,
      page text, stack text, created_at timestamptz
    );
    insert into academy_scan_access values (1,true),(2,false);
    insert into client_errors values
      (1,'same',1,11,'allowed','/a',null,'2026-01-01'),
      (2,'same',2,22,'closed','/b',null,'2026-01-02'),
      (3,'same',null,null,'unknown','/c',null,'2026-01-03');
  `);
  await db.exec(readFileSync(new URL('../../../supabase/150_academy_ai_context.sql', import.meta.url),'utf8'));
  const context = async () => (await db.query("select public.admin_ai_error_context('same') as result")).rows[0].result;
  await db.exec('set role service_role');
  const first = await context();
  assert.equal(first.message,'allowed'); assert.equal(first.events,1);
  assert.equal(first.users,1); assert.equal(first.academies,1);
  await db.exec('reset role; update academy_scan_access set enabled=false; set role service_role');
  assert.equal(await context(),null);
  for (const role of ['anon','authenticated']) {
    await db.exec('reset role; set role '+role);
    await assert.rejects(context,/permission denied/);
  }
  console.log('PostgreSQL: AI error context respects the switch for mixed, unknown and disabled academies; service-only access passed.');
} finally { await db.close(); }
