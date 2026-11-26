// One isolated PostgreSQL database exercises both real dispatchers in the same transaction.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '../../node_modules/homework-test-tools/node_modules/@electric-sql/pglite/dist/index.js';
import { fixtureIds, installHomeworkFixture } from './block-fixture.mjs';
import { installMaterialProjects } from './material-project-fixture.mjs';

const db = new PGlite();
const {a,c,student,otherStudent} = fixtureIds;
const selected = [student, randomUUID()];
const ordinary = { id:randomUUID(), revision:1, title:'Mixed materials', template:false, items:[
  { kind:'quiz', title:'뜻 고르기', config:{}, content:{questions:[
    {id:'choice',qtype:'choice',prompt:'road',choices:['길','책','바다','산'],correct:0,skill:'meaning',word:'road',gen:'test'},
  ]}},
] };
const one = async (sql, args = []) => (await db.query(sql,args)).rows[0];
async function send(request, project, receivers = selected) {
  await db.exec('set role authenticated');
  try {
    return (await one('select hw_assign_materials($1::uuid,$2::uuid[],$3::jsonb,null,$4::uuid,$5::jsonb) as value',
      [c,receivers,ordinary,request,project])).value;
  } finally {
    await db.exec('reset role');
  }
}
try {
  await installHomeworkFixture(db);
  await db.query('insert into students(id,academy_id,class_id,name) select unnest($1::uuid[]),$2,$3,\'QA Student\'', [[selected[1],...Array.from({length:4},()=>randomUUID())],a,c]);
  await installMaterialProjects(db);
  for (const limit of [5,10,15,7]) {
    const request = randomUUID();
    const project = { request:randomUUID(), title:'빈출 단어', source:{type:'curriculum',ranges:['level-unit']}, limit,
      cards:Array.from({length:24},(_,i)=>({word:'unit'+limit+'word'+i,meaning:'단어'+i})) };
    const result = await send(request, project);
    assert.equal(result.project.created,2);
    assert.deepEqual((await send(request,project)).assignment,result.assignment);
    assert.equal((await send(request,project)).project.plan_id,result.project.plan_id);
    const assigned = (await db.query('select student_id from homework_assignment_targets where assignment_id=$1',[result.assignment.id])).rows;
    const recurring = (await db.query('select student_id from wm_targets where plan_id=$1',[result.project.plan_id])).rows;
    assert.deepEqual(assigned.map(r=>r.student_id).sort(), [...selected].sort());
    assert.deepEqual(recurring.map(r=>r.student_id).sort(), [...selected].sort());
    const target = await one('select access_token from wm_targets where plan_id=$1 and student_id=$2',[result.project.plan_id,student]);
    const daily = (await one('select wm_today_state($1) as value',[target.access_token])).value;
    assert.equal(daily.counts.new,limit);
    assert.equal((await one('select wm_today_state($1) as value',[target.access_token])).value.session_id, daily.session_id);
    assert.equal((await one('select count(*)::int n from homework_items where assignment_id=$1',[result.assignment.id])).n,1);
  }
  const request = randomUUID();
  const invalid = {request:randomUUID(),limit:5,title:'invalid',source:{},cards:[{word:'few',meaning:'적은'}]};
  await assert.rejects(send(request,invalid), /too_few_words/);
  assert.equal((await one('select count(*)::int n from homework_assignments where block_request=$1',[request])).n,0);
  await assert.rejects(send(randomUUID(),invalid,[]), /no_students/);
  await assert.rejects(send(randomUUID(),invalid,[otherStudent]), /no_students/);
  assert.equal((await one("select has_function_privilege('anon','hw_assign_materials(uuid,uuid[],jsonb,timestamptz,uuid,jsonb)','execute') allowed")).allowed,false);
  const card = n => ({kind:'worksheet',title:'단어 익히기',config:{block:{
    schemaVersion:1,type:'speak',completion:'recording',groupKey:'wordset-1-learn',method:'material:learn',
    text:'Word '+n,translation:'뜻',question:'',imageUrl:'',audioUrl:'',videoUrl:'',repeats:1,stages:['model'],hiddenWords:[],
  }},content:{questions:[]}});
  const long = {...ordinary,items:Array.from({length:65},(_,i)=>card(i))};
  const assign = draft => one('select hw_assign_draft($1,$2::jsonb,$3::uuid[],null,$4) result',[c,draft,selected,randomUUID()]);
  const largeResult = await assign(long);
  assert.equal((await one('select count(*)::int n from homework_items where assignment_id=$1',[largeResult.result.id])).n,65);
  const legacy = structuredClone(long);
  for (const item of legacy.items) delete item.config.block.groupKey;
  await assert.rejects(assign(legacy), /no_items/);
  const expanded = {...long,items:[...long.items,...ordinary.items]};
  const mixedResult = await assign(expanded);
  assert.equal((await one('select count(*)::int n from homework_items where assignment_id=$1',[mixedResult.result.id])).n,66);
  const aboveLimit = {...long,items:[...long.items,...Array.from({length:60},()=>ordinary.items[0])]};
  await assert.rejects(assign(aboveLimit), /no_items/);
  const tooManyGroups = structuredClone(long);
  tooManyGroups.items.forEach((item, i) => { item.config.block.groupKey='group-'+i; });
  await assert.rejects(assign(tooManyGroups), /no_items/);
  const bad = structuredClone(long);
  bad.items[64].config.block.repeats=0;
  await assert.rejects(assign(bad), /bad_repeats/);
  const oversized = structuredClone(long);
  oversized.items[0].content.padding = 'x'.repeat(1000000);
  await assert.rejects(assign(oversized), /bad_items/);
  console.log('PASS: two recipients of six, atomic mixed dispatch, 5/10/15/custom daily ceilings, replay, rollback, class boundary, anonymous denial, 65 recording cards, legacy and size limits.');
} finally {
  await db.close();
}
