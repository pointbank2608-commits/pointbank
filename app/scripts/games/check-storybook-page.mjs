import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {createServer} from 'vite';
import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const names=[...readFileSync(resolve(root,'src/lib/api.ts'),'utf8').matchAll(/export (?:async )?function (\w+)|export const (\w+)/g)].map(m=>m[1]||m[2]);
const api=`
const rows=JSON.parse(sessionStorage.getItem('storybook-test-rows')||'[]');
const lessons=JSON.parse(sessionStorage.getItem('storybook-test-lessons')||'[]');
const flush=()=>{sessionStorage.setItem('storybook-test-rows',JSON.stringify(rows));sessionStorage.setItem('storybook-test-lessons',JSON.stringify(lessons));};
const lists=[{id:'words-test',kind:'word',name:'검증 단어장',items:['apple','banana','milk'].map((word,i)=>({id:String(i),word,meaning:['사과','바나나','우유'][i],image_url:null}))},{id:'sentences-test',kind:'sentence',name:'검증 문장',items:[{id:'s',word:'She goes to school.',meaning:'그녀는 학교에 가요.',image_url:null}]}];
const fn={fetchClasses:async()=>[{id:'class-test',academy_id:'academy-test',name:'검증 반'}],fetchMyStudentRow:async()=>({class_id:'class-test'}),fetchAllWordLists:async()=>lists,fetchWordLists:async()=>lists,
fetchGameTemplates:async(a,c,t)=>structuredClone(rows.filter(r=>r.game_type===t)),fetchGameTemplateById:async id=>structuredClone(rows.find(r=>r.id===id)),
createGameTemplate:async p=>{if(window.__failStorySave)throw Error('합성 저장 실패');const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,game_type:p.gameType,name:p.name,items:p.items,config:p.config,created_by:p.teacherId,updated_at:'test'};rows.push(row);flush();return structuredClone(row)},
updateGameTemplate:async(id,patch)=>{if(window.__failStorySave)throw Error('합성 저장 실패');const row=rows.find(r=>r.id===id);if(row){Object.assign(row,patch);flush()}},renameGameTemplate:async(id,name)=>{rows.find(r=>r.id===id).name=name;flush()},
fetchAllCurriculumLessons:async()=>structuredClone(lessons),fetchCurriculumLessonById:async id=>structuredClone(lessons.find(l=>l.id===id)),createCurriculumLesson:async p=>{const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,playlist:p.playlist};lessons.push(row);flush();return row},appendActivityToLesson:async(l,s)=>{lessons.find(r=>r.id===l.id).playlist.push(s);flush()}};
${names.map(n=>`export const ${n}=(...args)=>(fn.${n}||(async()=>[]))(...args);`).join('\n')}`;
const auth=`const value={academy:{id:'academy-test',plan:'paid',features:{group:true}},profile:{id:'teacher-test'},isStaff:new URLSearchParams(location.search).get('mode')!=='student',isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-test'}},trial:{active:true}};export const useAuth=()=>value;`;
const server=await createServer({root,logLevel:'error',plugins:[{name:'storybook-synthetic-only',enforce:'pre',load(id){const p=id.replaceAll('\\','/');if(p.endsWith('/src/lib/api.ts'))return api;if(p.endsWith('/src/context/AuthContext.tsx'))return auth;if(p.endsWith('/src/context/ToastContext.tsx'))return `const value={notify:(s)=>{window.__notice=s},run:async f=>{try{await f();return true}catch{return false}}};export const useToast=()=>value;`;if(p.endsWith('/src/lib/supabase.ts'))return 'export const supabase={};';}}],server:{host:'127.0.0.1',port:5195,strictPort:true,hmr:false}});
await server.listen();let browser,page;const results=[];const pass=s=>{results.push(s);console.log('PASS',s);};
try{
browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base='http://127.0.0.1:5195/scripts/games/storybook-page.html';
await page.goto(base+'?mode=games');await page.locator('a[href="/games/feedmonster"]').waitFor();
for(const game of ['feedmonster','sentencebridge','sentencetower'])assert.ok(await page.locator(`a[href="/games/${game}"]`).count());pass('All three games appear in the existing catalog');
for(const game of ['feedmonster','sentencebridge','sentencetower']){
 await page.goto(`${base}?game=${game}&mode=teacher`);await page.locator(`[data-game="${game}"]`).waitFor();console.log("STEP",game,"board");
 // The current workspace owns game start and exposes the native editor in a dialog.
 await page.getByRole('button',{name:'샘플로 먼저 해보기',exact:false}).click();
 await page.getByRole('button',{name:/게임 시작/}).click();console.log('STEP started');
 if(game==='feedmonster'){
  const a=await page.locator('[data-choice="apple"]').boundingBox(),b=await page.locator('.sb-mouth-target').boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});
  const ghost=await page.locator('.sb-drag-ghost').boundingBox();assert.ok(Math.abs(ghost.x+ghost.width/2-b.x-b.width/2)<3);
  await page.mouse.up();await page.locator('.sb-feedback.correct').waitFor();await page.waitForTimeout(1550);
 }
 await page.locator('.sb-overlay').waitFor({state:'hidden'});
 assert.equal(await page.locator('.sb-editor:visible').count(),0);
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();
 await page.getByRole('dialog',{name:'메뉴',exact:true}).getByRole('button',{name:'준비 화면으로',exact:true}).click();
 await page.locator('[data-game-preparation] summary').filter({hasText:'추가 설정'}).click();
 await page.locator('[data-game-preparation]').getByRole('button',{name:/게임 설정/}).click();
 await page.getByRole('button',{name:'새 게임으로 저장',exact:true}).click();
 await page.waitForFunction(g=>JSON.parse(sessionStorage.getItem('storybook-test-rows')||'[]').some(r=>r.game_type===g),game);
 const saved=await page.evaluate(g=>JSON.parse(sessionStorage.getItem('storybook-test-rows')).find(r=>r.game_type===g),game);
 assert.match(saved.name,new RegExp(game==='feedmonster'?'Feed the Monster':game==='sentencebridge'?'Sentence Bridge':'Sentence Tower'));
 await page.goto(`${base}?game=${game}&mode=embed&template=${saved.id}`);
 await page.locator('.sb-editor').first().waitFor();
 const sound=page.getByLabel('효과음',{exact:true});await sound.uncheck();
 assert.ok(await page.getByRole('button',{name:'새 게임으로 저장',exact:true}).isDisabled());
 assert.ok(await page.getByRole('button',{name:'수업에 삽입',exact:true}).isDisabled());
 await page.getByRole('button',{name:'설정 적용 · 미리보기',exact:true}).click();
 await page.waitForFunction(id=>JSON.parse(sessionStorage.getItem('storybook-test-rows')).find(r=>r.id===id).config.storybook.sound===false,saved.id);
 await page.reload();await page.getByLabel('효과음',{exact:true}).waitFor();assert.equal(await page.getByLabel('효과음',{exact:true}).isChecked(),false);
 if(game==='feedmonster'){
   await page.getByLabel('문제별 제한 시간',{exact:false}).selectOption('30');
   await page.evaluate(()=>{window.__failStorySave=true;});
   await page.getByRole('button',{name:'설정 적용 · 미리보기',exact:true}).click();
   await page.waitForFunction(()=>window.__notice==='합성 저장 실패');
   assert.equal(await page.getByLabel('문제별 제한 시간',{exact:false}).inputValue(),'30');
   assert.equal(await page.evaluate(id=>JSON.parse(sessionStorage.getItem('storybook-test-rows')).find(r=>r.id===id).config.storybook.seconds,saved.id),0);
   await page.evaluate(()=>{window.__failStorySave=false;});
   await page.getByRole('button',{name:'설정 적용 · 미리보기',exact:true}).click();
   await page.waitForFunction(id=>JSON.parse(sessionStorage.getItem('storybook-test-rows')).find(r=>r.id===id).config.storybook.seconds===30,saved.id);
   pass('Failed save preserves edits, original config, and allows retry; unapplied edits lock save buttons');
 }
 await page.getByRole('button',{name:'게임 시작',exact:false}).click();await page.locator('.sb-overlay').waitFor({state:'hidden'});
 pass(`${game}: workspace start/back, auto-title save, embedded edit, reload and play`);
 await page.getByRole('button',{name:'게임 준비로 돌아가기'}).click();
 await page.getByRole('button',{name:'수업에 삽입',exact:true}).click();
 await page.getByLabel('수업 선택',{exact:false}).selectOption('new');
 await page.getByLabel('수업 이름',{exact:false}).fill('스토리북 검증 수업');
 await page.getByRole('dialog').getByRole('button',{name:'수업에 추가',exact:false}).click();
 await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('storybook-test-lessons')||'[]').length>0);
 const lessons=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('storybook-test-lessons')));const lesson=lessons.at(-1);
 assert.equal(lesson.playlist[0].gameType,game);
 const templateId=lesson.playlist[0].templateId;
 await page.goto(`${base}?game=${game}&mode=embed&template=${templateId}`);await page.getByRole('button',{name:'게임 시작',exact:false}).click();await page.locator('.sb-overlay').waitFor({state:'hidden'});
 pass(`${game}: lesson snapshot created and its saved template replays`);
 await page.goto(`${base}?game=${game}&mode=student`);await page.locator(`[data-game="${game}"]`).waitFor();assert.equal(await page.locator('.sb-editor').count(),0);pass(`${game}: student view hides all content editors`);
}
assert.deepEqual(errors,[]);pass('No uncaught errors in integrated pages');writeFileSync(resolve(root,'../output/storybook/integration-results.json'),JSON.stringify({results,errors},null,2));
}catch(e){if(page){await page.screenshot({path:resolve(root,'../output/storybook/integration-failure.png'),fullPage:true});console.log((await page.locator('body').innerText()).slice(0,3500));}throw e;}finally{await browser?.close();await server.close();}
