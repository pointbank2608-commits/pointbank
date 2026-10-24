import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const env=await readFile('.env.local','utf8');
const ref=env.match(/VITE_SUPABASE_URL=https:\/\/([^.]+)/)[1];
const uid='00000000-0000-4000-8000-000000000001',aid='00000000-0000-4000-8000-0000000000aa',exp=Math.floor(Date.now()/1000)+86400;
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const user={id:uid,aud:'authenticated',role:'authenticated',email:'phonics-test@example.com',app_metadata:{},user_metadata:{}};
const session={access_token:`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:uid,role:'authenticated',exp,aud:'authenticated'})}.test-only`,refresh_token:'test-only',expires_at:exp,expires_in:86400,token_type:'bearer',user};
const profile={id:uid,academy_id:aid,role:'owner',display_name:'Phonics QA'};
const academy={id:aid,name:'QA',point_unit:'별',plan:'paid',plan_status:'active',deletion_requested_at:null,features:{group:true,solo:true,homework:true}};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('classbank.lang','ko');localStorage.setItem('classbank.printWatermark','off');},{key:`sb-${ref}-auth-token`,session});
import {createServer} from 'vite';
const classC='00000000-0000-4000-8000-0000000000c1',classA='00000000-0000-4000-8000-0000000000a1';
const lines=['Our class visits the moon.','We bring our red robots.'];
const list={id:'list-c-sentences',academy_id:aid,class_id:classC,name:'C반 우주 문장',kind:'sentence',items:lines.map((word,i)=>({id:'sentence-'+i,word,meaning:'수업 문장 '+i,image_url:null})),created_at:'2026-10-24',updated_at:'2026-10-25'};
let lesson={id:'lesson-c-splash',academy_id:aid,class_id:classC,name:'C반 Sentence Splash 수업',word_list_id:null,video_url:null,level:null,playlist:[{id:'splash-block',kind:'game',gameType:'sentencesplash'}],created_by:uid,created_at:'2026-10-24',updated_at:'2026-10-25',deleted_at:null};
const templates=[],writes=[];let failNext=false;let wordList;
await context.addInitScript(({classC})=>{localStorage.setItem('classbank.selectedClassId',classC);localStorage.setItem('classbank.startCheck.skip','1');if(location.pathname==='/curriculum'&&location.search.includes('qa-edit'))history.replaceState({usr:{reopenLessonId:'lesson-c-splash'},key:'splash-edit',idx:0},'');},{classC});
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname,q=url.searchParams,single=(req.headers().accept??'').includes('vnd.pgrst.object'),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};let data=single?{}:[];
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(path.includes('/auth/v1/user'))data=user;else if(path.includes('/auth/v1/'))data=session;
 else if(path.endsWith('/profiles'))data=single?profile:[profile];else if(path.endsWith('/academies'))data=single?academy:[academy];
 else if(path.endsWith('/classes'))data=[{id:classA,academy_id:aid,name:'A반',sort_order:1},{id:classC,academy_id:aid,name:'C반',sort_order:2}];
 else if(path.endsWith('/word_lists'))data=q.get('kind')==='eq.word'?[wordList]:q.get('kind')==='eq.sentence'?[list]:[wordList,list];
 else if(path.endsWith('/curriculum_lessons')){if(req.method()==='PATCH'){lesson={...lesson,...req.postDataJSON()};writes.push({type:'lesson',row:structuredClone(lesson)});}data=q.get('deleted_at')?.startsWith('not.')?[]:single?lesson:[lesson];}
 else if(path.endsWith('/game_templates')){
  const id=q.get('id')?.replace('eq.','');
  if(req.method()==='POST'){if(failNext){failNext=false;return route.fulfill({status:403,headers,json:{message:'QA 저장 실패',code:'42501'}});}const row={id:crypto.randomUUID(),...req.postDataJSON(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};templates.push(row);writes.push({type:'create',row:structuredClone(row)});data=row;}
  else if(req.method()==='PATCH'){if(failNext){failNext=false;return route.fulfill({status:403,headers,json:{message:'QA 저장 실패',code:'42501'}});}const row=templates.find(r=>r.id===id);assert(row,'only update an existing template');Object.assign(row,req.postDataJSON());writes.push({type:'update',row:structuredClone(row)});data=null;}
  else {let rows=templates.filter(r=>(!q.get('game_type')||r.game_type===q.get('game_type').replace('eq.',''))&&(!id||r.id===id));const requestedClass=q.get('or')?.match(/class_id\.eq\.([^,)]+)/)?.[1];if(requestedClass)rows=rows.filter(r=>r.class_id===requestedClass||r.class_id===null);if(q.get('class_id')?.startsWith('neq.'))rows=rows.filter(r=>r.class_id!==q.get('class_id').slice(4));data=single?rows[0]??null:rows;}
 }
 else if(path.endsWith('/rpc/my_deletion_request'))data=null;
 return route.fulfill({status:200,headers,json:data});
});
// Read-only probes expose the real hook/bridge in this test server, never production code.
const auditPort=Number(process.env.GAME_SAVE_AUDIT_PORT||5238);
const server=await createServer({server:{host:'127.0.0.1',port:auditPort,strictPort:true},logLevel:'error',plugins:[{name:'save-audit-probes',enforce:'pre',transform(code,id){const path=id.replaceAll('\\','/');code=code.replaceAll('\r\n','\n');if(path.endsWith('/src/lib/useGameTemplates.ts'))return code.replace('  return {\n    /** 커리큘럼',"  Object.assign(window,{__auditTemplate:{gameType,selected,loading}});\n  return {\n    /** 커리큘럼");if(path.endsWith('/src/components/GameWorkspace.tsx'))return code.replace('  const contentName = source?.name', '  Object.assign(window,{__auditWorkspace:info});\n  const contentName = source?.name');}}]});await server.listen();
const {GAME_CATALOG}=await server.ssrLoadModule('/src/lib/gameCatalog.ts');
const {gamePreparation,isNativeGameReady}=await server.ssrLoadModule('/src/lib/gamePreparation.ts');
const {prepareClassroomGame}=await server.ssrLoadModule('/src/lib/gameWorkspace.ts');
const {guideSample}=await server.ssrLoadModule('/src/lib/gameGuide.ts');
const {PHONICS_WORDS}=await server.ssrLoadModule('/src/data/phonicsCurriculum.ts');
const {ADVENTURE_TYPES}=await server.ssrLoadModule('/src/lib/adventureGames.ts');
const nativeTypes=[...ADVENTURE_TYPES,'feedmonster','sentencebridge','sentencetower'];
wordList={...list,id:'audit-words',name:'C반 점검 단어',kind:'word',items:['frog','fish','duck','pig','cow','bee','hen','fox'].map((word,i)=>{const meta=Object.values(PHONICS_WORDS).find(w=>w.word===word);return {id:'audit-word-'+i,word,meaning:meta.meaning,image_url:meta.imageUrl,category:i<4?'animals':'friends'};})};
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&/Maximum update|Encountered two children|Rendered.*hooks/.test(m.text()))errors.push(m.text());});
const root='http://127.0.0.1:'+auditPort,out='../output/game-save-audit';await mkdir(out,{recursive:true});
const reproduce=process.argv.includes('--reproduce'),nativeOnly=process.argv.includes('--native-only');
const report={games:[],native:[],errors};
async function hook(type,id){await page.waitForFunction(({type,id})=>{const h=window.__auditTemplate;return h?.gameType===type&&!h.loading&&(id===undefined||h.selected?.id===id);},{type,id});}
async function edit(type,templateId){lesson.playlist=[{id:'audit-'+type,kind:'game',gameType:type,...(templateId?{templateId}:{})}];await page.goto(root+'/curriculum?qa-edit=1');await hook(type,templateId);}
function payload(row){return JSON.parse(JSON.stringify({items:row.items,config:row.config}));}
try{
 await page.goto(root+'/games');
 if(!reproduce&&!nativeOnly)for(const [index,game] of GAME_CATALOG.entries()){
  await page.goto(root+game.path);await hook(game.type);await page.waitForFunction(()=>!!window.__auditWorkspace?.selected&&!window.__auditWorkspace.loading);
  await page.evaluate(c=>window.__auditWorkspace.selectClass(c),classC);await page.waitForFunction(c=>window.__auditWorkspace?.classId===c&&!window.__auditTemplate.loading,classC);
  const capabilities=gamePreparation(game.type);let imported=false;
  for(const kind of capabilities.kinds){const source=kind==='sentence'?list:wordList;if(!prepareClassroomGame(game.type,source))continue;await page.evaluate(source=>window.__auditWorkspace.useList(source),source);await page.waitForFunction(id=>window.__auditTemplate.selected?.config.classroomSource?.id===id,source.id);imported=true;break;}
  if(!imported){const selected=await page.evaluate(()=>window.__auditTemplate.selected);const content=guideSample(game.type,selected);
   if(content.config.adventure)content.config.adventure.seconds=60;
   else if(content.config.storybook)content.config.storybook.seconds=60;
   else if(game.type==='labeleddiagram')content.config.diagramPins[0].label='Saved custom pin';
   else if(game.type==='watermelon')content.items.find(i=>i.slot==='object').label='frogs';
   else if(game.type==='mathgen'){content.config.mathOperations=['mul'];content.config.mathQuestionCount=7;}
   else if(game.type==='airport')content.config.airportPlaces=['gate'];
   else if(game.type==='restaurant')content.config.restaurantLevels=['cafe'];
   await page.evaluate(content=>window.__auditWorkspace.applyGuide(content),content);await page.waitForFunction(()=>window.__auditTemplate?.selected?.id.startsWith('activity-draft:'));
  }
  const expected=await page.evaluate(()=>window.__auditTemplate.selected);assert(isNativeGameReady(expected),game.type+' valid prepared content');
  await page.evaluate(name=>window.__auditWorkspace.saveActivity(name),'저장 점검 '+game.type);await page.waitForFunction(()=>{const id=window.__auditTemplate?.selected?.id;return id&&!id.startsWith('activity-draft:');});
  const saved=templates.find(t=>t.name==='저장 점검 '+game.type);assert(saved,game.type+' saved template');assert.deepEqual(payload(saved),payload(expected),game.type+' current content saved');
  await edit(game.type,saved.id);assert.deepEqual(payload(await page.evaluate(()=>window.__auditTemplate.selected)),payload(saved),game.type+' editor restoration');
  await page.getByRole('button',{name:'저장',exact:true}).click();assert.equal(lesson.playlist[0].templateId,saved.id);
  await edit(game.type,saved.id);await page.getByRole('button',{name:/이 슬라이드부터 발표$/}).click();await hook(game.type,saved.id);assert.deepEqual(payload(await page.evaluate(()=>window.__auditTemplate.selected)),payload(saved),game.type+' presentation payload');
  await page.reload();await hook(game.type,saved.id);assert.deepEqual(payload(await page.evaluate(()=>window.__auditTemplate.selected)),payload(saved),game.type+' reload payload');
  await page.evaluate(()=>sessionStorage.removeItem('classbank.lessonRunner'));
  report.games.push({type:game.type,source:imported?'imported list':'native configuration',saved:true,lesson:true,presentation:true,reload:true});
  console.log('PASS '+(index+1)+'/'+GAME_CATALOG.length+' '+game.type);
 }
 for(const type of nativeTypes){
  // New unsaved lesson game: no pre-existing template may conceal the missing-link bug.
  for(let i=templates.length-1;i>=0;i--)if(templates[i].game_type===type)templates.splice(i,1);
  await page.evaluate(()=>sessionStorage.removeItem('classbank.lessonRunner'));await edit(type);assert.equal(await page.evaluate(()=>window.__auditTemplate.selected),null);
  const adventure=ADVENTURE_TYPES.includes(type);const editor=page.locator(adventure?'.ad-editor':'.sb-editor').last();
  await editor.getByRole('combobox',{name:adventure?/^제한 시간/:/^문제별 제한 시간/}).selectOption('60');
  if(!reproduce){
   failNext=true;
   await editor.getByRole('button',{name:adventure?'설정 적용 · 게임 다시 준비':'설정 적용 · 미리보기',exact:true}).click();
   await page.getByText('QA 저장 실패',{exact:true}).waitFor();
   assert.equal(templates.filter(t=>t.game_type===type).length,0,type+' failed creation must not create a reference');
   assert.equal(await page.evaluate(()=>window.__auditTemplate.selected),null);
   assert.equal(await editor.getByRole('combobox',{name:adventure?/^제한 시간/:/^문제별 제한 시간/}).inputValue(),'60',type+' failed creation retains input');
  }
  await editor.getByRole('button',{name:adventure?'설정 적용 · 게임 다시 준비':'설정 적용 · 미리보기',exact:true}).click();
  await page.getByText('게임 설정을 적용했어요.',{exact:true}).waitFor();
  if(reproduce){assert.equal(templates.filter(t=>t.game_type===type).length,0);await page.getByRole('button',{name:'저장',exact:true}).click();assert.equal(lesson.playlist[0].templateId,undefined);report.native.push({type,reproduced:true,localOnly:true});}
  else {
   await page.waitForFunction(()=>!!window.__auditTemplate.selected);const saved=templates.find(t=>t.game_type===type);
   assert(saved,type+' new config persisted');assert.equal(saved.class_id,classC);assert.equal((adventure?saved.config.adventure:saved.config.storybook).seconds,60);
   await page.getByRole('button',{name:'저장',exact:true}).click();assert.equal(lesson.playlist[0].templateId,saved.id);
   await edit(type,saved.id);assert.equal(await editor.getByRole('combobox',{name:adventure?/^제한 시간/:/^문제별 제한 시간/}).inputValue(),'60');
   await editor.getByRole('combobox',{name:adventure?/^제한 시간/:/^문제별 제한 시간/}).selectOption('30');failNext=true;
   await editor.getByRole('button',{name:adventure?'설정 적용 · 게임 다시 준비':'설정 적용 · 미리보기',exact:true}).click();
   await page.getByText('QA 저장 실패',{exact:true}).waitFor();
   assert.equal((adventure?saved.config.adventure:saved.config.storybook).seconds,60,type+' failed update keeps original');
   assert.equal(await editor.getByRole('combobox',{name:adventure?/^제한 시간/:/^문제별 제한 시간/}).inputValue(),'30');
   await editor.getByRole('button',{name:adventure?'설정 적용 · 게임 다시 준비':'설정 적용 · 미리보기',exact:true}).click();
   await page.waitForFunction(adventure=>(adventure?window.__auditTemplate.selected?.config.adventure:window.__auditTemplate.selected?.config.storybook)?.seconds===30,adventure);
   assert.equal(templates.filter(t=>t.game_type===type).length,1,type+' retry updates original without duplicates');
   await edit(type,saved.id);assert.equal(await editor.getByRole('combobox',{name:adventure?/^제한 시간/:/^문제별 제한 시간/}).inputValue(),'30');
   report.native.push({type,saved:true,restored:true,classScope:true,createFailureRetainsInput:true,updateFailureKeepsOriginal:true,retryWithoutDuplicates:true});
  }
  console.log((reproduce?'REPRODUCED ':'PASS native ')+type);
 }
 assert.deepEqual(errors,[]);await writeFile(out+(reproduce?'/reproduction.json':nativeOnly?'/native-checks.json':'/checks.json'),JSON.stringify({passed:true,...report},null,2));
}catch(e){report.failure={url:page.url(),message:e.message,hook:await page.evaluate(()=>window.__auditTemplate).catch(()=>null)};await writeFile(out+'/partial.json',JSON.stringify(report,null,2));await page.screenshot({path:out+'/failure.png',fullPage:true});console.error('AUDIT FAILED: '+e.message);process.exitCode=1;}finally{await browser.close();await server.close();}
