import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { app, fixtureIds } from './block-fixture.mjs';
import { materialDatabase, sentenceCards, wordCards } from './material-fixture.mjs';

const vite = await createServer({ root:app, configFile:false, appType:'custom', logLevel:'error',
  server:{ middlewareMode:true, hmr:false, watch:null, ws:false }, optimizeDeps:{ noDiscovery:true },
  plugins:[{ name:'no-network', enforce:'pre', load(id) {
    if (id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts')) return 'export const supabase={};';
  } }] });
const { db, students } = await materialDatabase();
const id = () => crypto.randomUUID();
const val = async (statement, params = []) => (await db.query('select ' + statement + ' as value', params)).rows[0].value;
const staff = () => db.exec(`reset role; set test.academy='${fixtureIds.a}'; set "test.user"='${fixtureIds.owner}'; set role authenticated;`);
const pupil = () => db.exec("reset role; set test.academy=''; set \"test.user\"=''; set role anon;");
const submit = (token, item, index, answer, request) => val('hw_submit($1,$2,$3,$4,$5,1800)', [token,item,index,answer,request]);
const progress = (token, item, meta, request = id()) => val("hw_progress($1,$2,'item_complete',$3,$4)", [token,item,JSON.stringify(meta),request]);
const home = token => val('student_home($1)', [token]);
const open = (session, code) => val('student_open_homework($1,$2)', [session, code]);

try {
  const { buildMaterialPlan } = await vite.ssrLoadModule('/src/lib/homework/materialPlan.ts');
  const { activityGroups } = await vite.ssrLoadModule('/src/lib/homework/activityGroups.ts');
  const { gradeLocal } = await vite.ssrLoadModule('/src/lib/homework/grade.ts');
  const { sceneMaterials } = await vite.ssrLoadModule('/src/lib/homework/materialSources.ts');
  const {selectHomeworkMaterial,dialogueKey}=await vite.ssrLoadModule('/src/lib/homework/materialSelection.ts');
  const vocabulary = { id:'road', name:'Road', kind:'word', cards:[wordCards[0]] };
  const sentences = { id:'map', name:'Map', kind:'sentence', cards:[sentenceCards[0]] };
  const only = (material, settings) => {
    const plan = buildMaterialPlan(material, settings, wordCards);
    assert.deepEqual(plan.issues, []);
    return plan.items[0];
  };
  async function assertQuestion(material, settings, prompt, answer) {
    const item = only(material, settings);
    const question = item.content.questions[0];
    assert.equal(question.prompt,prompt);
    assert.ok(gradeLocal(question,answer));
    const visible = await val('hw_public_item(jsonb_populate_record(null::homework_items,$1::jsonb))',[JSON.stringify(item)]);
    const shown = visible.content.questions[0];
    assert.equal(shown.prompt,prompt);
    assert.equal(shown.word,'');
    for (const field of ['correct','card','contentId','speak']) assert.ok(!(field in shown));
  }
  for (const [spelling, prompt, answer] of [['first','□oad','r'],['one','ro□d','a'],['all','□□□□','road']])
    await assertQuestion(vocabulary,{activities:['spell'],spelling},prompt,answer);
  for (const [mask, indices] of [[1,[3]],[3,[1,2,3]],['all',[0,1,2,3]]]) {
    const card = only(sentences,{activities:['hide'],mask}).config.block;
    assert.deepEqual(card.hiddenWords,indices);
    assert.equal(card.translation,sentenceCards[0].meaning);
  }
  await assertQuestion(sentences,{activities:['write'],writing:'blank'},'We need a ____.','map');
  await assertQuestion(sentences,{activities:['write'],writing:'full'},sentenceCards[0].meaning,'We need a map.');
  await assertQuestion(sentences,{activities:['order']},sentenceCards[0].meaning,JSON.stringify(['We','need','a','map.']));
  const oneChoice = only(vocabulary,{activities:['choice']}).content.questions[0];
  assert.equal(new Set(oneChoice.choices).size,4);
  assert.equal(oneChoice.choices[oneChoice.correct],wordCards[0].meaning);
  const clip = {id:'caillou',youtube_id:'DhKIqYVB_Ws',title:'Caillou',start_sec:0,end_sec:336,pack:{},script:'',tags:[]};
  const scene = sceneMaterials([clip]).find(s=>s.scene.start===0 && s.scene.lines.some(line=>line.speaker==='Caillou'));
  assert.ok(scene && scene.cards.length && scene.scene.lines.some(line=>line.speaker==='Dad'));
  const course = buildMaterialPlan(scene,{activities:['sceneWords','watch','echo','shadow','dub'],role:'Caillou'},[]);
  assert.deepEqual(course.issues,[]);
  const counts = activityGroups(course.items).map(group=>group.count);
  assert.deepEqual(counts,[scene.cards.length,1,scene.scene.lines.length,1,1]);
  const roleItem = only(scene,{activities:['dub'],role:'Caillou'});
  assert.equal(roleItem.config.block.role,'Caillou');
  assert.deepEqual(roleItem.content.lines,scene.scene.lines);
  assert.ok(buildMaterialPlan(scene,{activities:['dub'],role:'unknown'},[]).issues.length);
  const oneLine=scene.scene.lines.find(line=>line.speaker==='Caillou');
  const selectedLine=selectHomeworkMaterial(scene,{cardIds:[],lineIds:[dialogueKey(oneLine)]});
  assert.deepEqual(only(selectedLine,{activities:['dub'],role:'Caillou'}).content.lines,[oneLine]);
  const sceneWithoutLines=selectHomeworkMaterial(scene,{cardIds:[],lineIds:[]});
  assert.equal(only(sceneWithoutLines,{activities:['watch']}).config.block.start,scene.scene.start);
  assert.ok(buildMaterialPlan(sceneWithoutLines,{activities:['echo']},[]).issues.length);
  console.log('PASS teacher options and student projection: spelling x3, English masks x3, writing x2, order, four distinct choices, actual Caillou scene-only sources and assigned speaker');
  const source={id:'test-words',name:'Family Road Trip',kind:'word',cards:structuredClone([
    ...wordCards,{id:'roof',word:'roof',meaning:'지붕'},{id:'horn',word:'horn',meaning:'경적'},
  ])};
  const selectedWordIds=wordCards.map(card=>card.id);
  assert.equal(selectHomeworkMaterial(source,{}).cards.length,12);
  assert.equal(selectHomeworkMaterial(source,{cardIds:[]}).cards.length,0);
  const wordPlan = buildMaterialPlan(selectHomeworkMaterial(source,{cardIds:selectedWordIds}), { activities:['choice'] }, wordCards);
  const sentencePlan = buildMaterialPlan({ id:'test-sentences', name:'Family Road Trip', kind:'sentence', cards:sentenceCards }, { activities:['hide'], mask:1 }, []);
  assert.deepEqual([...wordPlan.issues, ...sentencePlan.issues], []);
  const draft = { id:id(), revision:0, title:'Family Road Trip', template:false, items:[...wordPlan.items,...sentencePlan.items] };
  await pupil();
  const sessions = [];
  for (const [i, student] of students.entries()) {
    const login = await val("student_login_by_phone($1,$2,'test client')", [student.name,'0100000000'+i]);
    assert.ok(login.token);
    sessions.push(login.token);
    assert.deepEqual((await home(login.token)).homework, []);
  }
  await staff();
  const targets = students.slice(0,2).map(s=>s.id);
  const request = id();
  const dispatch = () => val('hw_assign_draft($1,$2,$3,null,$4)', [fixtureIds.c, JSON.stringify(draft), targets, request]);
  const assigned = await dispatch();
  assert.deepEqual(await dispatch(), assigned);
  source.cards[0].word='changed after sending';
  source.cards.splice(1,1);
  await db.exec('reset role');
  await db.query('insert into students(id,academy_id,class_id,name) values ($1,$2,$3,$4)',[id(),fixtureIds.a,fixtureIds.c,'추가 학생']);
  await staff();
  const frozen=(await val('hw_publication($1)',[assigned.id]));
  assert.equal(frozen.items[0].content.questions[0].word,'road');
  assert.deepEqual(frozen.items[0].content.questions.map(q=>q.word),wordCards.map(card=>card.word));
  const overviewRow=(await val('hw_class_overview($1)',[fixtureIds.c])).find(row=>row.id===assigned.id);
  assert.equal(overviewRow.target_count,2);
  console.log('PASS content selection and issued snapshot: 10 of 12 words, selected dialogue, scene without words, immutable questions and recipient count after source and roster change');
  await pupil();
  const lists = await Promise.all(sessions.map(home));
  assert.deepEqual(lists.map(list=>list.homework.length), [1,1,0,0,0,0]);
  const targetLink = lists[0].homework[0].access;
  assert.deepEqual(await val('hw_open_personal($1)', [targetLink]), { code:assigned.code, requires_login:true });
  const targetOpen = session => val('student_open_homework_target($1,$2)', [session,targetLink]);
  for (const session of sessions.slice(2)) {
    assert.deepEqual(await open(session, assigned.code), {error:'not_found'});
    assert.deepEqual(await targetOpen(session), {error:'not_found'});
  }
  // Even the other recipient cannot open the first recipient's personal link.
  assert.deepEqual(await targetOpen(sessions[1]), {error:'not_found'});
  const {token} = await targetOpen(sessions[0]);
  assert.equal((await open(sessions[0], assigned.code)).token,token);
  const peer = (await open(sessions[1], assigned.code)).token;
  assert.ok(peer && peer !== token);
  console.log('PASS real local SQL: six phone logins, pre-dispatch empty, idempotent 2/6 delivery, unassigned shared/personal links and cross-recipient link denied');

  const state = () => val('hw_state($1)', [token]);
  const initial = await state();
  const [choice,...speaking] = initial.items;
  assert.deepEqual(activityGroups(initial.items).map(group=>group.count), [10,8]);
  assert.ok(choice.content.questions.every(question=>question.choices.length===4 && question.correct===undefined));
  assert.deepEqual(speaking.map(item=>item.config.block.translation), sentenceCards.map(card=>card.meaning));
  assert.ok(speaking.every(item=>item.config.block.hiddenWords.length===1));
  const answers = wordPlan.items[0].content.questions;
  for (const [i, question] of answers.entries()) {
    const req = id();
    const response = String(i===0 ? (question.correct + 1) % 4 : question.correct);
    const actual = await submit(token,choice.id,i,response,req);
    assert.equal(actual.correct, i!==0);
    assert.deepEqual(await submit(token,choice.id,i,response,req),actual);
  }
  await progress(token,choice.id,{});
  assert.equal((await state()).answers.length,10);
  await assert.rejects(val('hw_finish($1)',[token]), /incomplete/);
  const paths = [];
  let supersededPath;
  for (const [i,item] of speaking.entries()) {
    const hash = createHash('sha256').update('synthetic take for ' + i).digest('hex');
    await db.exec('reset role; set role service_role;');
    const reserve = () => val('hw_recording_target_v2($1,$2,$3)',[token,item.id,hash]);
    const {path,stored} = await reserve();
    assert.equal(stored,false);
    if (i === 0) {
      const previousHash = createHash('sha256').update('earlier synthetic take').digest('hex');
      supersededPath = (await val('hw_recording_target_v2($1,$2,$3)',[token,item.id,previousHash])).path;
      await db.exec('reset role');
      await db.query("insert into storage.objects(bucket_id,name,user_metadata) values ('homework-recordings',$1,$2)",
        [supersededPath,JSON.stringify({duration:1})]);
    }
    await pupil();
    await assert.rejects(progress(token,item.id,{recording:path,duration:2}), /incomplete/);
    // Test storage fixture only: the Edge handler and audio bytes have their own separate test.
    await db.exec('reset role');
    await db.query("insert into storage.objects(bucket_id,name,user_metadata) values ('homework-recordings',$1,$2)", [path,JSON.stringify({duration:2})]);
    await db.exec('set role service_role');
    assert.deepEqual(await reserve(), {path,stored:true,limit:120});
    await pupil();
    await assert.rejects(progress(peer,item.id,{recording:path,duration:2}), /incomplete/);
    const meta = {recording:path,duration:2,recordingCheck:i%2?'matched':'unrecognized',hints:1};
    const req = id();
    await progress(token,item.id,meta,req);
    await progress(token,item.id,meta,req);
    paths.push(path);
  }
  const complete = await val('hw_finish($1)',[token]);
  assert.equal(complete.score,9);
  assert.equal(complete.total,10);
  assert.deepEqual(await val('hw_finish($1)',[token]),complete);
  const finished = await state();
  assert.equal(finished.finished,true);
  assert.deepEqual(finished.item_attempts.filter(row=>row.meta.recording).map(row=>row.meta.recording).sort(), [...paths].sort());
  assert.equal((await home(sessions[1])).homework[0].done,false);
  assert.equal((await home(sessions[0])).homework[0].done,true);
  await assert.rejects(val('hw_block_results($1)',[assigned.id]),/permission denied/);
  await assert.rejects(val('hw_recording_access($1)',[paths[0]]),/permission denied/);
  console.log('PASS real local SQL: 10 server-graded choices, 8 per-sentence submissions, missing/cross-student recordings rejected, same take retry and unrecognized submissions accepted');

  await staff();
  const results = (await val('hw_block_results($1)', [assigned.id])).filter(row=>row.student_id===students[0].id);
  assert.equal(results.filter(row=>row.finished).length,9);
  assert.equal(results.find(row=>row.item_id===choice.id).first_correct,9);
  assert.equal(await val('hw_recording_access($1)',[supersededPath]),false);
  for (const [i,path] of paths.entries()) {
    assert.equal(results.find(row=>row.item_id===speaking[i].id).meta.recording,path);
    assert.equal(results.find(row=>row.item_id===speaking[i].id).meta.recordingCheck,i%2?'matched':'unrecognized');
    assert.equal(await val('hw_recording_access($1)',[path]),true);
  }
  await db.exec(`reset role; set test.academy='${fixtureIds.otherA}'; set role authenticated`);
  assert.equal(await val('hw_recording_access($1)',[paths[0]]),false);
  await assert.rejects(val('hw_block_results($1)',[assigned.id]),/not_found/);
  await db.exec('reset role');
  await db.query("update homework_assignments set closed_at=now(), due_at=now()-interval '2 days' where id=$1",[assigned.id]);
  await pupil();
  assert.deepEqual((await home(sessions[0])).homework.map(row=>row.done),[true]);
  assert.deepEqual((await home(sessions[1])).homework,[]);
  assert.equal((await targetOpen(sessions[0])).token,token);
  assert.equal((await state()).finished,true);
  await val('student_logout($1)',[sessions[0]]);
  assert.equal((await home(sessions[0])).error,'expired');
  await db.exec('reset role');
  assert.equal(await val("(select count(*)::int from learning_events where event_type='assignment_complete')"),1);
  console.log('PASS real local SQL: teacher results and recording permission, cross-academy denial, closed/expired homework read-only history, one completion event, explicit logout');

  await staff();
  const { materialWorkloadLabel } = await vite.ssrLoadModule('/src/lib/homework.ts');
  const overview = async assignmentId => (await val('hw_class_overview($1)',[fixtureIds.c])).find(row=>row.id===assignmentId);
  const mixed = await overview(assigned.id);
  assert.equal(mixed.question_count,10);
  assert.equal(materialWorkloadLabel(mixed.material_workload,false),'활동 2개 · 10문제 · 녹음 8개');
  const workloadOf = async items => {
    const snapshot = {...draft,id:id(),items};
    const sent = await val('hw_assign_draft($1,$2,$3,null,$4)',[fixtureIds.c,JSON.stringify(snapshot),targets,id()]);
    return overview(sent.id);
  };
  const recordingsOnly = await workloadOf(sentencePlan.items);
  assert.equal(materialWorkloadLabel(recordingsOnly.material_workload,false),'활동 1개 · 녹음 8개');
  assert.equal(materialWorkloadLabel((await workloadOf([roleItem])).material_workload,false),'활동 1개 · 녹음 1개');
  const legacy = structuredClone(wordPlan.items);
  delete legacy[0].config.block.groupKey;
  const legacyRow = await workloadOf(legacy);
  assert.equal(legacyRow.material_workload,null);
  assert.equal(legacyRow.question_count,10);
  console.log('PASS teacher workload labels: grouped mixed, recording-only, dubbing-only and original legacy graded count');
  const longText = 'We read the story together and '.repeat(8) + 'we draw a picture.';
  const sentence = {...sentenceCards[0],word:longText};
  const writing = only({...sentences,cards:[sentence]}, {activities:['write'],writing:'full'});
  const orderText = 'Everybody remembers beautifully painted butterflies and extraordinary adventures. '.repeat(2)
    + 'Everybody imagines brightly colored flowers.';
  const ordered = only({...sentences,cards:[{...sentence,word:orderText}]}, {activities:['order']});
  const legacyWriting = structuredClone(writing);
  legacyWriting.config.block.method = 'recall';
  delete legacyWriting.config.block.groupKey;
  const longDraft = {...draft,id:id(),items:[writing,ordered,legacyWriting]};
  const sent = await val('hw_assign_draft($1,$2,$3,null,$4)',[fixtureIds.c,JSON.stringify(longDraft),targets,id()]);
  await pupil();
  const writer = (await open(sessions[1],sent.code)).token;
  const [written,arranged,oldItem] = (await val('hw_state($1)',[writer])).items;
  const firstSubmit = id();
  assert.equal((await submit(writer,written.id,0,longText,firstSubmit)).correct,true);
  assert.equal((await submit(writer,written.id,0,longText,firstSubmit)).first,true);
  const retry = id();
  const incorrect = 'x'.repeat(300);
  assert.equal((await submit(writer,written.id,0,incorrect,retry)).correct,false);
  await assert.rejects(submit(writer,written.id,0,incorrect+'x',id()),/bad_response/);
  const arrangement = JSON.stringify(ordered.content.questions[0].correct);
  assert.ok(arrangement.length>200 && arrangement.length<=300);
  assert.equal((await submit(writer,arranged.id,0,arrangement,id())).correct,true);
  assert.equal((await submit(writer,oldItem.id,0,longText,id())).correct,true);
  await assert.rejects(val('hw_submit_before_blocks($1,$2,0,$3,$4,0)',[writer,written.id,longText,id()]),/permission denied/);
  const saved = (await val('hw_state($1)',[writer])).answers;
  assert.equal(saved.find(row=>row.item_id===written.id).response,longText);
  assert.equal(saved.find(row=>row.item_id===arranged.id).response,arrangement);
  assert.equal(saved.find(row=>row.item_id===oldItem.id).response,longText.slice(0,200));
  await db.exec('reset role');
  assert.equal(await val('(select response from learning_events where client_id=$1)',[retry]),incorrect);
  console.log('PASS material sentence writing/order preserve the full first answer and retries; earlier results, legacy caps and direct RPC grants remain intact');
} finally {
  await db.close();
  await vite.close();
}
