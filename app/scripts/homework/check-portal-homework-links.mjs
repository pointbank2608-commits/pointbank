import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js';
import { pgcrypto } from '../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/contrib/pgcrypto.js';
import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { createGuidedServer } from './guided-server.mjs';

const read = name => readFileSync(new URL('../../../supabase/'+name, import.meta.url),'utf8');
function definition(file, name) {
  const start = file.indexOf('create or replace function public.'+name+'(');
  assert.ok(start >= 0,name);
  const end = file.indexOf('$$;',file.indexOf('$$',start)+2);
  return file.slice(start,end+3);
}

const db = new PGlite({extensions:{pgcrypto}});
try {
  await db.exec([
    'create role anon; create role authenticated;',
    'create schema extensions; create extension pgcrypto with schema extensions;',
    'create table academies(id uuid primary key, student_code text);',
    'create table students(id uuid primary key, academy_id uuid, name text, archived_at timestamptz);',
    'create table student_guardian(student_id uuid, phone_hash text, phone_last4 text);',
    "create table student_sessions(token uuid default gen_random_uuid(), student_id uuid, device text, expires_at timestamptz default now()+interval '1 hour', last_seen_at timestamptz default now());",
    'create table student_login_failures(fail_key text, failed_at timestamptz default now());',
    'create table homework_assignments(id uuid primary key, code text, academy_id uuid, created_at timestamptz default now(), closed_at timestamptz, due_at timestamptz);',
    'create table homework_assignment_targets(assignment_id uuid, student_id uuid, access_token text, token_expires_at timestamptz);',
    'create table homework_attempts(assignment_id uuid, student_id uuid, token uuid default gen_random_uuid(), total int, last_seen_at timestamptz default now(), unique(assignment_id,student_id));',
    'create function academy_feature(uuid,text) returns boolean language sql as $$select true$$;',
  ].join('\n'));
  const portal = read('045_student_portal.sql');
  for (const name of ['sp_phone_digits','sp_name_key','student_session_student']) await db.exec(definition(portal,name));
  await db.exec(definition(read('046_student_login_duplicates.sql'),'student_login'));
  await db.exec(definition(read('041_homework_v2.sql'),'hw_open_personal'));
  await db.exec(read('113_student_portal_homework_links.sql'));
  await db.exec(read('114_student_portal_login_by_phone.sql'));
  const [a,b,student,other,assignment] = Array.from({length:5},()=>crypto.randomUUID());
  await db.query("insert into academies values ($1,'ABC123'),($2,'XYZ789')",[a,b]);
  await db.query("insert into students values ($1,$2,'민서',null),($3,$4,'민서',null)",[student,a,other,b]);
  await db.query("insert into student_guardian select id,extensions.crypt('01012345678',extensions.gen_salt('bf',4)),'5678' from students");
  await db.query("insert into homework_assignments(id,code,academy_id) values ($1,'100001',$2)",[assignment,a]);
  await db.query("insert into homework_assignment_targets values ($1,$2,'synthetic-access',null)",[assignment,student]);
  const value = async (sql, args) => (await db.query(sql,args)).rows[0].value;
  const login = (code,phone) => value("select student_login_for_homework($1,'민서',$2) value",[code,phone]);
  const open = token => value("select student_open_homework($1,'100001') value",[token]);
  const otherSession = await value('insert into student_sessions(student_id) values ($1) returning token value',[other]);
  await db.exec('set role anon');
  assert.deepEqual(await login('100001','01099999999'),{error:'bad_login'});
  assert.deepEqual(await login('999999','01012345678'),{error:'bad_login'});
  const {token} = await login('100001','010-1234-5678');
  assert.ok(token);
  const first = await open(token);
  assert.ok(first.token);
  assert.equal(first.code,'100001');
  assert.deepEqual(await open(token),first);
  assert.deepEqual(await open(otherSession),{error:'not_found'});
  await assert.rejects(open(crypto.randomUUID()),/expired/);
  const direct = (name,phone) => value('select student_login_by_phone($1,$2) value',[name,phone]);
  assert.deepEqual(await direct('민서','01012345678'),{error:'ambiguous_login'});
  await db.exec('reset role');
  await db.query('update students set archived_at=now() where id=$1',[other]);
  await db.exec('set role anon');
  const directSession = await direct(' 민서 ','010-1234-5678');
  assert.deepEqual(await open(directSession.token),first);
  for(let i=0;i<8;i++)assert.deepEqual(await direct('없는 학생','01099999999'),{error:'bad_login'});
  assert.deepEqual(await direct('없는 학생','01099999999'),{error:'locked'});
  await db.exec('reset role');
  const rows = await db.query('select student_id from homework_attempts');
  assert.deepEqual(rows.rows,[{student_id:student}]);
  console.log('PASS database: name and phone scoped to homework academy, unauthorized student denied, same attempt resumed.');
} finally {
  await db.close();
}

const server = await createGuidedServer();
let browser;
try {
  await server.listen();
  browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const base = 'http://127.0.0.1:5410/scripts/homework/guided-fixture.html?go=';
  await page.goto(base+encodeURIComponent('/hw/100001'));
  await page.waitForURL('**/s?hw=100001');
  await page.getByLabel('내 이름',{exact:true}).fill('민서');
  await page.getByLabel(/보호자 전화번호/).fill('01012345678');
  assert.equal(await page.locator('form input').count(),2);
  await page.getByRole('button',{name:'들어가기'}).click();
  await page.waitForURL('**/hw/100001');
  await page.getByText('테스트 숙제 이어서',{exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>localStorage.getItem('classbank.hw.100001')==='homework-token'));
  await page.reload();
  await page.getByText('테스트 숙제 이어서',{exact:true}).waitFor();
  await page.evaluate(()=>localStorage.clear());
  await page.goto(base+encodeURIComponent('/s'));
  await page.getByLabel('내 이름',{exact:true}).fill('민서');
  await page.getByLabel(/보호자 전화번호/).fill('01012345678');
  assert.equal(await page.locator('form input').count(),2);
  await page.getByRole('button',{name:'들어가기'}).click();
  await page.getByText('민서, 안녕!',{exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>window.__guided.calls.some(call=>call.name==='student_login_by_phone')));
  await page.evaluate(()=>localStorage.clear());
  await page.goto(base+encodeURIComponent('/s?c=ABC123'));
  await page.getByLabel('내 이름',{exact:true}).fill('민서');
  await page.getByLabel(/보호자 전화번호/).fill('01012345678');
  assert.equal(await page.locator('form input').count(),2);
  await page.getByRole('button',{name:'들어가기'}).click();
  await page.getByText('민서, 안녕!',{exact:true}).waitFor();
  console.log('PASS browser: shared homework link → two-field portal login → original homework → reload; direct /s and academy portal link use the same two fields.');
} finally {
  await browser?.close();
  await server.close();
}
