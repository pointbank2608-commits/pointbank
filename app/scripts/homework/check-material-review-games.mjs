import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { app,fixtureIds } from './block-fixture.mjs';
import { materialDatabase,wordCards,sentenceCards } from './material-fixture.mjs';
import { installMaterialProjects } from './material-project-fixture.mjs';

const vite=await createServer({root:app,configFile:false,appType:'custom',logLevel:'error',
  server:{middlewareMode:true,ws:false,watch:null,hmr:false},optimizeDeps:{noDiscovery:true},
  esbuild:{jsx:'automatic'},oxc:{jsx:{runtime:'automatic'}},plugins:[{name:'isolated',enforce:'pre',load(id){
    if(id.replaceAll('\\','/').endsWith('/src/lib/supabase.ts'))return 'export const supabase={}';
  }}]});
const {db,students}=await materialDatabase();
const uuid=()=>crypto.randomUUID();
const rpc=async(sql,args=[])=>(await db.query('select '+sql+' as val',args)).rows[0].val;
try{
  await installMaterialProjects(db);
  const {buildReviewGames,reviewGames,reviewGameSource,reviewGameNames}=await vite.ssrLoadModule('/src/lib/homework/materialReviewGames.ts');
  const {selectHomeworkMaterial,dialogueKey}=await vite.ssrLoadModule('/src/lib/homework/materialSelection.ts');
  const {publicationGroups}=await vite.ssrLoadModule('/src/lib/homework/publishedActivityGroups.ts');
  const {newBlock}=await vite.ssrLoadModule('/src/lib/homework/blocks.ts');
  const Runner=(await vite.ssrLoadModule('/src/components/homework/HomeworkRunner.tsx')).default;
  const Teacher=(await vite.ssrLoadModule('/src/components/homework/teacher/MaterialReviewGames.tsx')).default;
  const i18n=createInstance();
  await i18n.init({lng:'ko',resources:{ko:{translation:{}}}});
  const render=el=>renderToStaticMarkup(createElement(I18nextProvider,{i18n},el));
  const materials=[{id:'trip',kind:'word',name:'12 words',cards:[...wordCards,{id:'out1',word:'unselected',meaning:'미선택'},{id:'out2',word:'extra',meaning:'추가'}].slice(0,10)}];
  const sourceWords=wordCards.map(c=>c.word);
  assert.deepEqual(buildReviewGames(materials,[],false),{items:[],issues:[]});
  const onlySentences=[{id:'lines',kind:'sentence',name:'Trip lines',cards:sentenceCards}];
  assert.ok(reviewGameSource(onlySentences,'memory',false).reason);
  assert.equal(reviewGameSource(onlySentences,'flip',false).reason,'');
  assert.equal(reviewGameSource(materials,'memory',false).cards.length,10);
  const teacher=render(createElement(Teacher,{materials:onlySentences,enabled:true,games:[],en:false,onGames(){},onEnabled(){}}));
  assert.ok(teacher.includes('게임으로 복습하기'));
  const classic=['memory','flip','guess','shoot'];
  const {items,issues}=buildReviewGames(materials,classic,false);
  assert.deepEqual(issues,[]);assert.equal(items.length,4);
  const rounds=items[0].content.questions;
  assert.deepEqual(rounds.map(q=>q.word).sort(),[...sourceWords].sort());
  assert.equal(new Set(rounds.map(q=>q.round)).size,2);
  for(const n of [2,6,11]){
    const cards=Array.from({length:n},(_,i)=>({word:'entry'+i,meaning:'단어'+i,id:String(i)}));
    const [memory]=buildReviewGames([{...materials[0],cards}],['memory'],false).items;
    assert.equal(memory.content.questions.length,n);
    assert.ok(memory.content.questions.every(q=>q.choices.length>=2 && q.choices.length<=5));
  }
  const draft={id:uuid(),revision:0,title:'Selected review games',template:false,items};
  const sent=await rpc('hw_assign_draft($1,$2,$3,null,$4)',[fixtureIds.c,JSON.stringify(draft),[students[0].id],uuid()]);
  const login=await rpc("student_login_by_phone($1,'01000000000','test')",[students[0].name]);
  const {token}=await rpc('student_open_homework($1,$2)',[login.token,sent.code]);
  const state=await rpc('hw_state($1)',[token]);
  assert.ok(!JSON.stringify(state.items).includes('unselected'));
  const overview=(await rpc('hw_class_overview($1)',[fixtureIds.c])).find(h=>h.id===sent.id);
  assert.equal(overview.material_workload.activities,4);
  assert.equal(overview.material_workload.practice,10);
  const renderGame=i=>render(createElement(Runner,{title:draft.title,items:[state.items[i]],initialAnswers:new Map(),
    finishedItems:new Set(),shadowLinesDone:new Map(),alreadyFinished:false,api:{},saveState:'saved',preview:true,startImmediately:true}));
  assert.ok(renderGame(0).includes('단어 카드를 뒤집고'));
  assert.ok(renderGame(1).includes(sourceWords[0]));
  assert.ok(renderGame(2).includes(items[2].content.questions[0].prompt));
  assert.ok(renderGame(3).includes('과녁을 쏘세요'));
  for(const [idx,item] of state.items.entries()){
    assert.ok(item.content.questions.every(q=>q.correct===undefined));
    for(const [i,q] of items[idx].content.questions.entries()){
      const answer=q.qtype==='order'?JSON.stringify(q.correct):String(q.correct);
      const score=await rpc('hw_submit($1,$2,$3,$4,$5,1200)',[token,item.id,i,answer,uuid()]);
      assert.equal(score.correct,true);
    }
    await rpc("hw_progress($1,$2,'item_complete',$3,$4)",[token,item.id,JSON.stringify(idx===1?{confirmed:true}:{}),uuid()]);
  }
  assert.deepEqual(await rpc('hw_finish($1)',[token]),{score:30,total:30});
  console.log('PASS selected 10 of 12 only, disabled/enabled, sentence compatibility, four actual runner screens, real teacher dispatch and student completion (30 graded, 10 flips)');
  const lines=[
    {s:139,e:141,en:'Copy this page.',ko:'이 쪽을 복사해.'},
    {s:142,e:145,en:'Keep this line unchecked.',ko:'이 대사는 제외해.'},
  ];
  const chapter={id:'episode/chapter/1',kind:'scene',name:'Copier',cards:[
    {id:'c',word:'copy',meaning:'복사하다',category:'action',example:lines[1].en,imageUrl:null},
    {id:'g',word:'glasses',meaning:'안경',category:'object',imageUrl:null},
    {id:'f',word:'folder',meaning:'폴더',category:'object',imageUrl:null},
  ],scene:{videoUrl:'https://www.youtube.com/watch?v=abcdefghijk',start:134,end:297,lines}};
  const selectedChapter=selectHomeworkMaterial(chapter,{cardIds:['c','g'],lineIds:[dialogueKey(lines[0])]});
  const added=reviewGames.filter(key=>!classic.includes(key));
  const built=buildReviewGames([selectedChapter],added,false);
  assert.equal(added.length,17);
  assert.deepEqual(built.issues,[]);
  assert.equal(built.items.length,added.length);
  const noLines=selectHomeworkMaterial(chapter,{cardIds:['c','g'],lineIds:[]});
  assert.ok(reviewGameSource([noLines],'train',false).reason);
  const noWords=selectHomeworkMaterial(chapter,{cardIds:[],lineIds:[dialogueKey(lines[0])]});
  assert.ok(reviewGameSource([noWords],'fish',false).reason);
  assert.ok(!reviewGameSource([noWords],'train',false).reason);
  assert.deepEqual(reviewGameSource([noWords],'flip',false).cards.map(card=>card.word),[lines[0].en]);
  const capped=reviewGameSource(materials,'fish',false);
  assert.equal(capped.questionCount,8);
  assert.equal(buildReviewGames(materials,['fish'],false).items[0].content.questions.length,capped.questionCount);
  assert.equal(publicationGroups(built.items.map(item=>({item,key:uuid()}))).length,added.length);
  const sentGames=await rpc('hw_assign_draft($1,$2,$3,null,$4)',[fixtureIds.c,JSON.stringify({...draft,id:uuid(),items:built.items}),[students[0].id],uuid()]);
  const gameAttempt=await rpc('student_open_homework($1,$2)',[login.token,sentGames.code]);
  const saved=(await rpc('hw_state($1)',[gameAttempt.token])).items;
  assert.ok(!JSON.stringify(saved).includes('folder'));
  assert.ok(!JSON.stringify(saved).includes(lines[1].en));
  let total=0;
  for(const [i,it] of saved.entries()){
    const game=added[i];
    assert.equal(it.config.game,game);
    assert.equal(it.config.block.groupKey,'review-game:'+game);
    assert.equal(it.title,reviewGameNames[game][0]);
    assert.ok(it.content.questions.every(q=>q.correct===undefined && ['copy','glasses',lines[0].en].includes(q.word)));
    for(const [qi,q] of built.items[i].content.questions.entries()){
      const answer=q.qtype==='order'?JSON.stringify(q.correct):String(q.correct);
      const result=await rpc('hw_submit($1,$2,$3,$4,$5,600)',[gameAttempt.token,it.id,qi,answer,uuid()]);
      assert.equal(result.correct,true,game);
      total++;
    }
    await rpc("hw_progress($1,$2,'item_complete',$3,$4)",[gameAttempt.token,it.id,'{}',uuid()]);
  }
  assert.deepEqual(await rpc('hw_finish($1)',[gameAttempt.token]),{score:total,total});
  const completed=(await rpc('hw_class_overview($1)',[fixtureIds.c])).find(row=>row.id===sentGames.id);
  assert.equal(completed.done,1);
  assert.equal(completed.avg_pct,100);
  assert.equal(completed.material_workload.activities,added.length);
  assert.equal(completed.material_workload.questions,total);
  console.log('PASS 17 catalog games: selected chapter words/line only, saved game titles and groups, student submission, teacher completion and score');
  const large=buildReviewGames([{...materials[0],cards:Array.from({length:100},(_,i)=>({id:'w'+i,word:'word'+i,meaning:'뜻'+i}))}],['flip'],false).items;
  const ordinary=newBlock('study');ordinary.config.block.text='Read.';
  const bulk=[...Array.from({length:59},()=>structuredClone(ordinary)),...large];
  assert.equal(bulk.length,61);
  await rpc('hw_validate_items($1,false)',[JSON.stringify(bulk)]);
  assert.equal(publicationGroups(bulk.map(item=>({item,key:uuid()}))).length,60);
  console.log('PASS split 100-card game is one logical activity in publication and database checks');
}finally{await db.close();await vite.close();}
