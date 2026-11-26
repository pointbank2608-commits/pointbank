import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js';
import { installHomeworkFixture, fixtureIds, sqlRoot } from './block-fixture.mjs';

const db = new PGlite();
const scalar = async (query, params) => (await db.query(query, params)).rows[0].v;
try {
  await installHomeworkFixture(db);
  for (const name of ['093a_watch_tables.sql', '155_homework_material_recordings.sql']) {
    await db.exec(readFileSync(join(sqlRoot, name), 'utf8'));
  }
  const base = { schemaVersion:1, type:'speak', completion:'recording', text:'road', translation:'길', question:'',
    imageUrl:'', videoUrl:'', audioUrl:'', start:0, end:30, stages:['model'], hiddenWords:[], repeats:1 };
  const items = [
    { ...base, method:'material:learn' },
    { ...base, method:'material:dub', start:134, end:297, videoUrl:'https://youtu.be/DhKIqYVB_Ws', role:'Dad' },
  ].map(block => ({kind:'worksheet', title:block.method, config:{block}, content:{questions:[]}}));
  const {c,student}=fixtureIds;
  const assignment = await scalar('select hw_assign_draft($1,$2,array[$3::uuid],null,$4) v',
    [c, JSON.stringify({id:crypto.randomUUID(), revision:0, title:'Test recordings', template:false,items}),student,crypto.randomUUID()]);
  const attempt = (await db.query('insert into homework_attempts(assignment_id,student_id) values($1,$2) returning id,token',[assignment.id,student])).rows[0];
  const [learn,dub] = (await db.query('select id from homework_items where assignment_id=$1 order by position',[assignment.id])).rows.map(r=>r.id);
  const target = async (item,digest) => scalar('select hw_recording_target_v2($1,$2,$3) v',[attempt.token,item,digest.repeat(64)]);
  const upload = async(path,duration) => db.query('insert into storage.objects(bucket_id,name,user_metadata) values($1,$2,$3)', ['homework-recordings',path,JSON.stringify({duration})]);
  const complete = async(item,meta,id=crypto.randomUUID()) => scalar("select hw_progress($1,$2,'item_complete',$3,$4) v",[attempt.token,item,JSON.stringify(meta),id]);
  const old = await target(learn,'a'), final = await target(learn,'b');
  assert.equal(final.limit,120);
  assert.equal(final.stored,false);
  await upload(old.path,1);
  assert.equal((await target(learn,'a')).stored,true);
  await assert.rejects(complete(learn,{recording:final.path,meaningSeen:true,duration:1}), /incomplete/);
  await upload(final.path,1);
  await assert.rejects(complete(learn,{recording:final.path,duration:1}), /incomplete/);
  await assert.rejects(complete(learn,{recording:final.path,meaningSeen:true,duration:125}), /bad_recording/);
  const submission = crypto.randomUUID();
  for (let i=0;i<2;i++) await complete(learn,{recording:final.path,meaningSeen:true,duration:1,recordingCheck:'unavailable'}, submission);
  const rows = await scalar('select hw_block_results($1) v',[assignment.id]);
  assert.equal(rows.find(r=>r.item_id===learn).meta.recording,final.path);
  assert.equal(await scalar('select hw_recording_access($1) v',[old.path]),false);
  assert.equal(await scalar('select hw_recording_access($1) v',[final.path]),true);
  const scene = await target(dub,'c');
  assert.equal(scene.limit,168);
  await upload(scene.path,163);
  await complete(dub,{recording:scene.path,duration:163,watched:true,recordingCheck:'matched'});
  const finished = await scalar('select hw_finish($1) v',[attempt.token]);
  assert(Object.hasOwn(finished,'total'));
  const saved = await scalar('select count(*)::int v from homework_item_attempts where attempt_id=$1 and finished_at is not null',[attempt.id]);
  assert.equal(saved,2);
  console.log('PASS material recording SQL: authorized paths, same-file retry, meaning + recording gate, recognition unavailable, old take denied, teacher final take, long assigned scene, exactly-once completion.');
} finally { await db.close(); }
