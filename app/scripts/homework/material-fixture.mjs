import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js';
import { pgcrypto } from '../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/contrib/pgcrypto.js';
import { fn, table, installHomeworkFixture, fixtureIds, sqlRoot } from './block-fixture.mjs';

const sql = file => readFileSync(resolve(sqlRoot,file),'utf8');
export async function materialDatabase() {
  const db = new PGlite({extensions:{pgcrypto}});
  await installHomeworkFixture(db);
  await db.exec(`create schema extensions; create extension pgcrypto with schema extensions;
    alter table homework_assignment_targets add column access_token text default gen_random_uuid()::text unique;
    alter table homework_attempts add column rewarded_at timestamptz;
    alter table academies add column name text default '테스트 학원', add column student_code text default 'TEST01';
    alter table classes add column name text default '테스트 반';
    create function solo_list(uuid) returns jsonb language sql as $$ select '[]'::jsonb $$;`);
  const portal=sql('045_student_portal.sql'),hw=sql('041_homework_v2.sql');
  for(const name of ['student_guardian','student_sessions','student_login_failures']) await db.exec(table(portal,name));
  for(const name of ['sp_name_key','sp_phone_digits','student_session_student','student_login','student_logout']) await db.exec(fn(portal,name));
  for(const name of ['hw_open_personal','hw_class_overview','hw_assignment_summary']) await db.exec(fn(hw,name));
  for(const file of ['074d_student_home_features.sql','093a_watch_tables.sql','113_student_portal_homework_links.sql','114_student_portal_login_by_phone.sql','144_short_memory_rounds.sql','151_edit_published_homework.sql','152_edit_homework_activities.sql','154_material_homework_portal.sql','155_homework_material_recordings.sql','157_material_homework_workload.sql']) await db.exec(sql(file));
  const {a,c,student}=fixtureIds;
  const names=['하늘','바다','구름','강','봄','별'];
  const students=[];
  for(const [i,name] of names.entries()) {
    const id=i ? crypto.randomUUID() : student;
    if(i) await db.query('insert into students(id,academy_id,class_id,name) values ($1,$2,$3,$4)',[id,a,c,name]);
    else await db.query('update students set name=$1 where id=$2',[name,id]);
    const phone='0100000000'+i;
    await db.query(`insert into student_guardian(student_id,phone_hash,phone_last4,phone_enc,consent_at) values($1,extensions.crypt($2,extensions.gen_salt('bf')),right($2,4),''::bytea,now())`,[id,phone]);
    students.push({id,name,class_id:c});
  }
  return {db,students};
}

export const wordCards=['road|길','bus|버스','map|지도','tie|넥타이','boat|배','bag|가방','lake|호수','house|집','dog|개','cat|고양이'].map((s,i)=>card(s,'w'+i));
export const sentenceCards=['We need a map.|우리는 지도가 필요해요.','Dad wears a tie.|아빠는 넥타이를 매요.','This is our bus.|이것은 우리 버스예요.','I see a boat.|나는 배를 봐요.','Take your bag.|가방을 가져가세요.','We like the lake.|우리는 호수를 좋아해요.','I see my dog.|나는 내 개를 봐요.','The cat sleeps.|고양이는 자요.'].map((s,i)=>card(s,'s'+i));
function card(s,id){const [word,meaning]=s.split('|');return {id,word,meaning,imageUrl:null};}
