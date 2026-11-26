import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { app, fixtureIds } from './block-fixture.mjs';
import { materialDatabase, sentenceCards, wordCards } from './material-fixture.mjs';
import { installMaterialProjects } from './material-project-fixture.mjs';

const {db,students} = await materialDatabase();
const vite = await createServer({root:app,configFile:false,appType:'custom',logLevel:'error',
  server:{middlewareMode:true,hmr:false,watch:null,ws:false},optimizeDeps:{noDiscovery:true},
  plugins:[{name:'isolated',enforce:'pre',load(id) {
    if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts')) return 'export const supabase={};';
  }}]});
const uuid = () => crypto.randomUUID();
const rpc = async (sql,args=[]) => (await db.query('select '+sql+' as value',args)).rows[0].value;
const teacher = (academy=fixtureIds.a) => db.exec(`reset role; set test.academy='${academy}'; set "test.user"='${fixtureIds.owner}'; set role authenticated`);
const student = () => db.exec(`reset role; set test.academy=''; set "test.user"=''; set role anon`);
const state = token => rpc('hw_state($1)',[token]);
const finish = token => rpc('hw_finish($1)',[token]);
const complete = (token,item,meta) => rpc("hw_progress($1,$2,'item_complete',$3,$4)",[token,item,JSON.stringify(meta),uuid()]);

try {
  await installMaterialProjects(db);
  const {buildMaterialPlan} = await vite.ssrLoadModule('/src/lib/homework/materialPlan.ts');
  const {estimateMinutes} = await vite.ssrLoadModule('/src/lib/homework/build.ts');
  const {activityGroups} = await vite.ssrLoadModule('/src/lib/homework/activityGroups.ts');
  const {publicationGroups,publicationIssues} = await vite.ssrLoadModule('/src/lib/homework/publishedActivityGroups.ts');
  const {newBlock} = await vite.ssrLoadModule('/src/lib/homework/blocks.ts');
  const collection = (id,kind,cards) => ({id,name:id,kind,cards});
  const words = collection('trip words','word',wordCards);
  const sentences = collection('trip sentences','sentence',sentenceCards.slice(0,1));
  const plan = (material,activity) => {
    const built = buildMaterialPlan(material,{activities:[activity]},wordCards);
    assert.deepEqual(built.issues,[]);
    return built.items;
  };
  const clip = {kind:'scene',id:'timed-segment',name:'Timed segment',cards:[],
    scene:{videoUrl:'https://youtu.be/abcdefghijk',start:12,end:312,lines:[{s:14,e:19,en:'Look!',speaker:'Sam'}]}};
  for(const activity of ['dub','shadow']){
    const timed = buildMaterialPlan(clip,{activities:[activity],role:'Sam'},[]);
    assert.deepEqual(timed.issues,[]);
    assert.equal(estimateMinutes(timed.items),5);
    assert.equal(estimateMinutes(timed.items,2),10);
  }
  const quiz = plan(words,'choice');
  const oral = plan(sentences,'repeat');
  const issuedItems = [...quiz,...oral];
  const assignedStudents = students.slice(0,2);
  const targets = assignedStudents.map(s=>s.id);
  const send = (title,items) => rpc('hw_assign_draft($1,$2,$3,null,$4)',[fixtureIds.c,
    JSON.stringify({id:uuid(),revision:0,title,template:false,items}),targets,uuid()]);
  await teacher();
  const assigned = await send('Published material regression',issuedItems);
  const publication = () => rpc('hw_publication($1)',[assigned.id]);
  const recordingOriginals = () => db.query('select * from hw_recording_originals($1)',[assigned.id]);
  const edit = (doc,items,itemIds) => rpc('hw_edit_activities($1,$2,$3,null,$4,$5)',[assigned.id,doc.version,doc.title,JSON.stringify(items),itemIds]);
  const before = await publication();
  assert.equal(before.started,false);
  assert.equal(activityGroups(before.items.map((item,i)=>({...item,id:before.itemIds[i]}))).length,2);
  assert.ok(estimateMinutes(before.items)>1);
  await teacher(fixtureIds.otherA);
  await assert.rejects(recordingOriginals(),/not_found/);
  await assert.rejects(publication(),/bad_class|not_found/);
  await assert.rejects(edit(before,before.items,before.itemIds),/not_found/);
  await student();
  await assert.rejects(recordingOriginals(),/permission denied/);
  await assert.rejects(publication(),/permission denied/);
  await assert.rejects(edit(before,before.items,before.itemIds),/permission denied/);
  const participants = [];
  for (const [index,s] of assignedStudents.entries()) {
    const session = (await rpc("student_login_by_phone($1,$2,'test')",[s.name,'0100000000'+index])).token;
    const ownHome = await rpc('student_home($1)',[session]);
    const access = ownHome.homework[0].access;
    const {token} = await rpc('student_open_homework_target($1,$2)',[session,access]);
    for (const [i,q] of quiz[0].content.questions.entries()) {
      const answer = index===1 && i===0 ? (q.correct+1)%q.choices.length : q.correct;
      await rpc('hw_submit($1,$2,$3,$4,$5,1500)',[token,before.itemIds[0],i,String(answer),uuid()]);
    }
    await complete(token,before.itemIds[0],{});
    await db.exec('reset role; set role service_role');
    const {path} = await rpc('hw_recording_target_v2($1,$2,$3)',[token,before.itemIds[1],'1'.repeat(64)]);
    await db.exec('reset role');
    // Storage metadata represents an accepted two-second take. Device capture is tested separately.
    await db.query("insert into storage.objects(bucket_id,name,user_metadata) values('homework-recordings',$1,$2)",[path,JSON.stringify({duration:2})]);
    await student();
    await complete(token,before.itemIds[1],{recording:path,duration:2,recordingCheck:'matched'});
    participants.push({s,token,path,access,session});
  }
  const [finished,ongoing] = participants;
  assert.deepEqual(await finish(finished.token),{score:10,total:10});
  const attemptsBefore = await state(ongoing.token);
  await teacher();
  const source = await publication();
  const activeOriginal = (await recordingOriginals()).rows;
  assert.equal(activeOriginal[0].id,source.itemIds[1]);
  assert.equal(activeOriginal[0].config.block.text,sentenceCards[0].word);
  const addition = plan(words,'spell');
  await edit(source,[...source.items,...addition],[...source.itemIds,null]);
  const edited = await publication();
  assert.deepEqual(edited.itemIds.slice(0,2),before.itemIds);
  await assert.rejects(edit(source,source.items,source.itemIds),/publication_changed/);
  assert.ok(estimateMinutes(edited.items)>estimateMinutes(source.items));
  const workload = async () => (await rpc('hw_class_overview($1)',[fixtureIds.c])).find(r=>r.id===assigned.id).material_workload;
  assert.deepEqual(await workload(),{activities:3,questions:20,recordings:1,videos:0,practice:0});
  await student();
  const submitted = await state(finished.token);
  assert.deepEqual(submitted.items.map(i=>i.id),before.itemIds);
  assert.equal(submitted.item_attempts.find(r=>r.item_id===before.itemIds[1]).meta.recording,finished.path);
  assert.deepEqual(await finish(finished.token),{score:10,total:10});
  const more = await state(ongoing.token);
  assert.deepEqual(more.answers,attemptsBefore.answers);
  assert.deepEqual(more.item_attempts,attemptsBefore.item_attempts);
  const pending = more.items.filter(i=>!more.item_attempts.some(r=>r.item_id===i.id && r.finished));
  assert.deepEqual(pending.map(i=>i.id),[edited.itemIds[2]]);
  await assert.rejects(finish(ongoing.token),/incomplete/);
  for (const [i,q] of addition[0].content.questions.entries()) {
    await rpc('hw_submit($1,$2,$3,$4,$5,1500)',[ongoing.token,pending[0].id,i,String(q.correct),uuid()]);
  }
  await complete(ongoing.token,pending[0].id,{});
  assert.deepEqual(await finish(ongoing.token),{score:19,total:20});
  console.log('PASS post-issue edit preserves oral take, grades, IDs and original completed layout; only the new activity is required in progress');

  await teacher();
  // Retire every material snapshot. The teacher and submitted students must still see their actual work.
  const old = await publication();
  const ordinary = newBlock('study');
  ordinary.config.block.text='Read the map.';
  const legacyShadow = {kind:'shadowing',title:'Repeat',config:{},content:{questions:[],lines:[{en:'A map.',s:0,e:1},{en:'The road.',s:1,e:2}]}};
  const legacyVideo = {kind:'shadowing',title:'Watch',config:{watch:true},content:{questions:[]}};
  await edit(old,[ordinary,legacyShadow,legacyVideo],[null,null,null]);
  assert.deepEqual(await workload(),{activities:3,questions:0,recordings:0,videos:1,practice:3});
  assert.deepEqual((await recordingOriginals()).rows,activeOriginal);
  const results = await rpc('hw_block_results($1)',[assigned.id]);
  const summary = await rpc('hw_assignment_summary($1)',[assigned.id]);
  for (const [index,{s,path,token}] of participants.entries()) {
    const oralResult = results.find(row=>row.student_id===s.id && row.item_id===before.itemIds[1]);
    assert.equal(oralResult.meta.recording,path);
    assert.equal(await rpc('hw_recording_access($1)',[path]),true);
    const receipt = summary.students.find(row=>row.student_id===s.id);
    assert.deepEqual([receipt.correct,receipt.submitted_total],index ? [19,20] : [10,10]);
    await student();
    assert.deepEqual((await state(token)).items.map(row=>row.id),index ? edited.itemIds : before.itemIds);
    await teacher();
  }
  await student();
  const personal = await rpc('hw_open_personal($1)',[finished.access]);
  assert.equal(personal.requires_login,true,'Replacing all material blocks must retain original dispatch access policy');
  console.log('PASS retired snapshot preserves submissions, per-student score denominators, reviewed audio and original personal-link policy');

  await teacher();
  const reissue = (source,draft,recipients,request) => rpc('hw_reissue_publication($1,$2,$3,null,$4)',[
    source,JSON.stringify(draft),recipients,request]);
  const target = students[2];
  const replaced = await publication();
  const draft = {id:uuid(),revision:0,title:'Reissued after replacing every material activity',template:false,items:replaced.items};
  const request = uuid();
  await teacher(fixtureIds.otherA);
  await assert.rejects(reissue(assigned.id,draft,[target.id],request),/not_found/);
  await student();
  await assert.rejects(reissue(assigned.id,draft,[target.id],request),/permission denied/);
  await teacher();
  await assert.rejects(reissue(assigned.id,draft,[],request),/no_students/);
  await assert.rejects(reissue(assigned.id,draft,[fixtureIds.otherStudent],request),/no_students/);
  await assert.rejects(reissue(assigned.id,draft,[target.id,fixtureIds.otherStudent],request),/bad_student/);
  const inherited = await reissue(assigned.id,draft,[target.id],request);
  assert.deepEqual(await reissue(assigned.id,draft,[target.id],request),inherited);
  assert.deepEqual((await rpc('hw_publication($1)',[inherited.id])).students,[target.id]);
  const copyWorkload = async id => (await rpc('hw_class_overview($1)',[fixtureIds.c])).find(r=>r.id===id).material_workload;
  assert.deepEqual(await copyWorkload(inherited.id),await workload());
  await student();
  const newSession = (await rpc("student_login_by_phone($1,$2,'test')",[target.name,'01000000002'])).token;
  const inheritedLink = (await rpc('student_home($1)',[newSession])).homework[0].access;
  assert.deepEqual(await rpc('hw_open_personal($1)',[inheritedLink]),{code:inherited.code,requires_login:true});
  assert.equal((await rpc('student_open_homework_target($1,$2)',[participants[0].session,inheritedLink])).error,'not_found');
  assert.ok((await rpc('student_open_homework_target($1,$2)',[newSession,inheritedLink])).token);
  await teacher();
  const legacy = await send('Original legacy homework',[ordinary]);
  await assert.rejects(reissue(legacy.id,draft,[target.id],request),/request_conflict/);
  const regularCopy = await reissue(legacy.id,draft,[target.id],uuid());
  assert.equal(await copyWorkload(regularCopy.id),null);
  const shortItem = structuredClone(quiz[0]);
  delete shortItem.config.block.groupKey;
  const repeat = {minimum:2,threshold:70};
  const shortSource = await rpc('hw_assign_short($1,$2,$3,null,$4)',[fixtureIds.c,
    JSON.stringify({...draft,id:uuid(),items:[shortItem],shortRepeat:repeat}),targets,uuid()]);
  const shortCopy = await reissue(shortSource.id,{...draft,items:[shortItem]},[target.id],uuid());
  assert.deepEqual((await rpc('hw_publication($1)',[shortCopy.id])).shortRepeat,repeat);
  assert.equal(await copyWorkload(shortCopy.id),null);
  console.log('PASS reissue atomically inherits login and workload for replaced activities, checks source access and recipients, preserves ordinary and short homework, and retries once');

  const longOral = plan(collection('64 recordings','sentence',Array.from({length:64},(_,i)=>({
    ...sentenceCards[i%sentenceCards.length],id:'sentence-'+i,
  }))),'repeat');
  const large = await send('64 sentences and a quiz',[...longOral,...quiz]);
  const largeDoc = await rpc('hw_publication($1)',[large.id]);
  const groups = publicationGroups(largeDoc.items.map((item,i)=>({key:largeDoc.itemIds[i],item})));
  assert.deepEqual(groups.map(group=>group.rows.length),[64,1]);
  assert.deepEqual(publicationIssues(groups),[]);
  const oneOralGroup = groups[0].rows.map(row=>row.item);
  assert.ok(estimateMinutes(oneOralGroup) > estimateMinutes([oneOralGroup[0]]));
  assert.ok(estimateMinutes(largeDoc.items,2) >= 2*estimateMinutes(largeDoc.items)-1);
  const reordered = [...groups].reverse().flatMap(group=>group.rows);
  await rpc('hw_edit_activities($1,$2,$3,null,$4,$5)',[large.id,largeDoc.version,largeDoc.title,
    JSON.stringify(reordered.map(row=>row.item)),reordered.map(row=>row.key)]);
  const afterMove = await rpc('hw_publication($1)',[large.id]);
  assert.deepEqual(afterMove.itemIds,reordered.map(row=>row.key));
  assert.equal(estimateMinutes(afterMove.items),estimateMinutes(largeDoc.items));
  const mixedRows = [...reordered,{key:uuid(),item:ordinary}];
  assert.deepEqual(publicationIssues(publicationGroups(mixedRows)),[]);
  await rpc('hw_edit_activities($1,$2,$3,null,$4,$5)',[large.id,afterMove.version,afterMove.title,
    JSON.stringify(mixedRows.map(row=>row.item)),[...afterMove.itemIds,null]]);
  const combined = await rpc('hw_publication($1)',[large.id]);
  assert.deepEqual(combined.itemIds.slice(0,-1),afterMove.itemIds);
  const newTarget = students[2].id;
  const reissued = await reissue(large.id,{id:uuid(),revision:0,title:'Reissued to one student',template:false,items:combined.items},[newTarget],uuid());
  const copy = await rpc('hw_publication($1)',[reissued.id]);
  assert.notEqual(reissued.id,large.id);
  assert.deepEqual(copy.students,[newTarget]);
  assert.deepEqual(copy.items,combined.items);
  assert.ok(copy.itemIds.every(id=>!combined.itemIds.includes(id)));
  assert.deepEqual((await rpc('hw_publication($1)',[large.id])).students,[...targets].sort());
  console.log('PASS 65 stored items form two groups, preserve duration and IDs on reorder, accept a legacy activity and reissue independently; 5-minute scene dub/shadow estimates');
} finally {
  await db.close();
  await vite.close();
}
