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
const templates=[],writes=[];let failNext=false;
await context.addInitScript(({classC})=>{localStorage.setItem('classbank.selectedClassId',classC);localStorage.setItem('classbank.startCheck.skip','1');if(location.pathname==='/curriculum'&&location.search.includes('qa-edit'))history.replaceState({usr:{reopenLessonId:'lesson-c-splash'},key:'splash-edit',idx:0},'');},{classC});
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname,q=url.searchParams,single=(req.headers().accept??'').includes('vnd.pgrst.object'),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};let data=single?{}:[];
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 if(path.includes('/auth/v1/user'))data=user;else if(path.includes('/auth/v1/'))data=session;
 else if(path.endsWith('/profiles'))data=single?profile:[profile];else if(path.endsWith('/academies'))data=single?academy:[academy];
 else if(path.endsWith('/classes'))data=[{id:classA,academy_id:aid,name:'A반',sort_order:1},{id:classC,academy_id:aid,name:'C반',sort_order:2}];
 else if(path.endsWith('/word_lists'))data=q.get('kind')==='eq.word'?[]:[list];
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
const server=await createServer({server:{host:'127.0.0.1',port:5234,strictPort:true},logLevel:'error'});await server.listen();
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));const root='http://127.0.0.1:5234',out='../output/splash-lesson-save';await mkdir(out,{recursive:true});
const reproduce=process.argv.includes('--reproduce');
const editor=()=>page.getByRole('region',{name:'Sentence Splash 편집',exact:true});
const labels=()=>editor().getByRole('textbox',{name:/^문장 \d+$/});
async function openEditor(){await page.goto(root+'/curriculum?qa-edit=1');await editor().waitFor();await editor().getByRole('button',{name:/문장 목록에서 불러오기/}).click();await editor().getByRole('button',{name:/C반 우주 문장/}).waitFor();}
async function begin(){const overlay=page.locator('[data-game-ready-overlay]');if(await overlay.isVisible())await overlay.getByRole('button').click();const start=page.locator('.splash-game').getByRole('button',{name:'게임 시작!',exact:true});if(await start.isVisible())await start.click();await page.locator('[data-splash-phase=playing]').waitFor();}
try{
 await openEditor();await editor().getByRole('button',{name:/C반 우주 문장/}).click();
 if(reproduce){
  await page.waitForFunction(()=>[...document.querySelectorAll('input')].some(e=>e.value==='Our class visits the moon.'));assert.equal(templates.length,0);assert.equal(await labels().count(),9);
  await page.getByRole('button',{name:'저장',exact:true}).click();assert.equal(lesson.playlist[0].templateId,undefined);await writeFile(out+'/reproduction.json',JSON.stringify({reproduced:true,class:'C반',importedEditorRows:9,savedTemplates:templates.length,lessonTemplateMissing:true},null,2));console.log('REPRODUCED: C-class import remains editor-only; lesson saves without game reference and 7 demo sentences remain.');
 }else{
  await page.waitForFunction(()=>document.querySelector('.splash-pills')?.textContent.includes('1 / 2'));assert.deepEqual(await labels().evaluateAll(es=>es.map(e=>e.value)),lines);assert.equal(templates.length,1);assert.equal(templates[0].class_id,classC);assert.deepEqual(templates[0].items.map(i=>i.label),lines);
  await page.getByRole('button',{name:'저장',exact:true}).click();assert.equal(lesson.playlist[0].templateId,templates[0].id);
  await openEditor();assert.deepEqual(await labels().evaluateAll(es=>es.map(e=>e.value)),lines);
  const original=structuredClone(templates[0]);
  const foreign={id:crypto.randomUUID(),academy_id:aid,class_id:classA,game_type:'sentencesplash',name:'A반 보존 게임',items:[{id:'a-only',label:'Only class A reads this.'}],config:{splashSeconds:90}};templates.push(structuredClone(foreign));
  const modified='Only our class uses this sentence.';await editor().getByRole('textbox',{name:'문장 1',exact:true}).fill(modified);await editor().getByRole('combobox',{name:'문장당 제한 시간',exact:true}).selectOption('60');await editor().getByRole('textbox',{name:'게임 이름',exact:true}).fill('C반 수정본');
  await editor().getByRole('button',{name:'새 게임으로 저장',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.splash-pills')?.textContent.includes('60'));
  const copy=templates.find(r=>r.name==='C반 수정본');assert(copy);assert.equal(copy.items[0].label,modified);assert.equal(copy.config.splashSeconds,60);assert.deepEqual(copy.config.classroomSource.cards.map(c=>c.word),[modified,lines[1]]);assert.deepEqual(templates.find(r=>r.id===original.id),original,'copy does not overwrite original');
  const retry="I won't lose my edits.";await editor().getByRole('textbox',{name:'문장 1',exact:true}).fill(retry);failNext=true;await editor().getByRole('button',{name:'미리보기 적용',exact:true}).click();await editor().getByText(/입력 내용은 유지/).waitFor();assert.equal(await editor().getByRole('textbox',{name:'문장 1',exact:true}).inputValue(),retry);assert.equal(copy.items[0].label,modified);
  await editor().getByRole('button',{name:'미리보기 적용',exact:true}).click();await editor().getByText(/미리보기에 적용/).waitFor();assert.equal(copy.items[0].label,retry);assert.equal(copy.config.classroomSource.cards[0].word,retry);
  const imports=page.getByRole('combobox',{name:'문장 목록으로 바꾸기',exact:true});await imports.selectOption(list.id);await page.waitForFunction(()=>document.querySelector('.splash-pills')?.textContent.includes('45'));
  const imported=templates.filter(r=>r.class_id===classC&&r.game_type==='sentencesplash').at(-1);assert.deepEqual(imported.items.map(i=>i.label),lines);assert.equal(imported.config.classroomSource.id,list.id);
  await page.getByRole('button',{name:'저장',exact:true}).click();assert.equal(lesson.playlist[0].templateId,imported.id);assert.equal(lesson.playlist[0].ownWordListId,list.id);
  await openEditor();await page.getByRole('button',{name:/이 슬라이드부터 발표$/}).click();await page.locator('.splash-game').waitFor();assert.match(await page.locator('.splash-pills').textContent(),/1 \/ 2/);
  await begin();assert.deepEqual((await page.locator('.splash-brick').allTextContents()).sort(),lines[0].split(' ').sort());
  await page.screenshot({path:out+'/saved-lesson-playing.png'});await page.reload();await page.locator('.splash-game').waitFor();await begin();assert.deepEqual((await page.locator('.splash-brick').allTextContents()).sort(),lines[0].split(' ').sort());
  await page.getByRole('button',{name:'수업 끝내기',exact:true}).click();await editor().waitFor();
  lesson.playlist=[{id:'unscramble-block',kind:'game',gameType:'unscramble'}];await page.goto(root+'/curriculum?qa-edit=1');await page.getByRole('combobox',{name:'문장 목록으로 바꾸기',exact:true}).selectOption(list.id);await page.waitForFunction(()=>document.querySelector('.game-embed')?.textContent.includes('Our class visits the moon.'));
  await page.getByRole('button',{name:'저장',exact:true}).click();const unscramble=templates.find(r=>r.id===lesson.playlist[0].templateId);assert.equal(unscramble.game_type,'unscramble');assert.deepEqual(unscramble.items.map(i=>i.label),lines);assert.deepEqual(templates.find(r=>r.id===foreign.id),foreign,'other class unchanged');
  const {splashSampleItems}=await server.ssrLoadModule('/src/lib/sentenceSplash.ts');const legacy={id:crypto.randomUUID(),academy_id:aid,class_id:classC,game_type:'sentencesplash',name:'예전 저장 샘플',items:splashSampleItems(),config:{splashSeconds:60}};templates.push(legacy);lesson.playlist=[{id:'legacy-splash',kind:'game',gameType:'sentencesplash',templateId:legacy.id}];await openEditor();assert.equal(await labels().count(),7);await editor().getByRole('button',{name:/C반 우주 문장/}).click();await page.waitForFunction(()=>document.querySelector('.splash-pills')?.textContent.includes('1 / 2'));assert.deepEqual(legacy.items.map(i=>i.label),lines);assert.equal(legacy.config.splashSeconds,60);
  await writeFile(out+'/checks.json',JSON.stringify({passed:true,importSaved:true,classScope:true,lessonReference:true,reopen:true,copyUsesCurrentEdits:true,sourcePreserved:true,saveFailureRetainsEdits:true,retry:true,lessonSentencePicker:true,playedSavedSentences:true,reloadedGame:true,unscrambleRegression:true,otherClassUnchanged:true,legacyDemoReimport:true,errors},null,2));console.log('PASS: C-class import, current edits, failure/retry, lesson reload/play, Unscramble and previously saved demo repair.');
 }
 await page.screenshot({path:out+(reproduce?'/before.png':'/after.png'),fullPage:true});assert.deepEqual(errors,[]);
}catch(e){await page.screenshot({path:out+'/failure.png',fullPage:true});throw e;}finally{await browser.close();await server.close();}
