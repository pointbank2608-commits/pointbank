import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
mkdirSync(resolve(root,"../output/ux-remaining"),{recursive:true});
const names = [
  ...readFileSync(resolve(root, "src/lib/api.ts"), "utf8").matchAll(
    /export (?:async )?function (\w+)|export const (\w+)/g,
  ),
].map((m) => m[1] || m[2]);
const stub = `
import { isActivityDraft, patchActivityDraft } from '/src/lib/quickActivity.ts';
const academy={id:'academy-a',features:{group:true,homework:true},plan:'paid'};
const registeredClasses=[{id:'class-a',academy_id:'academy-a',name:'합성 A반'},{id:'class-b',academy_id:'academy-a',name:'합성 B반'}];
const classes=registeredClasses;
const students=[{id:'alice',name:'Alice',academy_id:'academy-a',class_id:'class-a'},{id:'bob',name:'Bob',academy_id:'academy-a',class_id:'class-a'}];
const lists=[{id:'words',academy_id:'academy-a',class_id:'class-a',kind:'word',name:'합성 과일',updated_at:'2026-10-19',items:[{id:'apple',word:'apple',meaning:'사과',image_url:'/word-bank-images/apple.webp',category:'fruit'},{id:'banana',word:'banana',meaning:'바나나',image_url:'/word-bank-images/banana.webp',category:'fruit'},{id:'cat',word:'cat',meaning:'고양이',image_url:'/word-bank-images/cat.webp',category:'animal'},{id:'dog',word:'dog',meaning:'강아지',image_url:null,category:'animal'}]},{id:'sentences',academy_id:'academy-a',class_id:'class-a',kind:'sentence',name:'합성 문장',updated_at:'2026-10-19',items:[{id:'s',word:'I like cats.',meaning:'나는 고양이를 좋아해요.',image_url:null}]}];
window.__workspace=JSON.parse(sessionStorage.getItem('UX점검.backend')||'null')||{templates:[],writes:[],fail:false,empty:false,lessons:[]};window.__persist=()=>sessionStorage.setItem('UX점검.backend',JSON.stringify(window.__workspace));
if(new URLSearchParams(location.search).has('student'))window.__workspace.templates.push({id:'student-game',academy_id:'academy-a',class_id:'class-a',game_type:'wheel',name:'학생용 저장 게임',items:[{id:'a',label:'apple'},{id:'b',label:'cat'}],config:{}});
if(new URLSearchParams(location.search).has('saved'))window.__workspace.templates.push({id:'original-game',academy_id:'academy-a',class_id:null,game_type:'wheel',name:'원본 저장 게임',items:[{id:'original',label:'ORIGINAL'}],config:{}});
const functions={
fetchMyStudentRow:async()=>({class_id:'class-a'}),
wordListKindOf:(list)=>list.kind==='sentence'?'sentence':'word',
updateWordListItems:async(id,items)=>{if(window.__workspace.fail)throw new Error('synthetic word update failure'); const list=lists.find(row=>row.id===id);if(list)list.items=items;},
fetchSavedGames:async()=>structuredClone(window.__workspace.templates),fetchClasses:async()=>classes,fetchStudentsOfClass:async()=>students,fetchStudentsOfAcademy:async()=>students,
createWordList:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic save failure'); const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,kind:p.kind,items:p.items,updated_at:'now'};(window.__workspace.wordWrites||=[]).push(row);lists.push(row);return row;},
fetchAllWordLists:async()=>window.__workspace.empty?[]:structuredClone(lists),fetchAllCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
fetchCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
fetchCurriculumLessonById:async(id)=>structuredClone((window.__workspace.lessons||[]).find(x=>x.id===id)),
updateCurriculumLesson:async(id,p)=>{if(window.__workspace.fail)throw Error('UX점검 lesson update failed');Object.assign(window.__workspace.lessons.find(x=>x.id===id),p);window.__persist();},
createCurriculumLesson:async(p)=>{if(window.__workspace.fail)throw Error('UX점검 create lesson failed');const l={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,word_list_id:p.wordListId,video_url:null,level:p.level,playlist:p.playlist,updated_at:'now'};(window.__workspace.lessons||=[]).push(l);window.__persist();return structuredClone(l);},
appendActivityToLesson:async(l,s)=>{if(window.__workspace.fail||window.__workspace.failAppend)throw Error('UX점검 append failed');window.__workspace.lessons.find(row=>row.id===l.id).playlist.push(s);window.__persist();},
fetchWordLists:async(_a,_c,k='all')=>structuredClone(k==='all'?lists:lists.filter(x=>x.kind===k)),
fetchGameTemplates:async(_a,_c,type)=>window.__workspace.templates.filter(x=>x.game_type===type),
createGameTemplate:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic failure');const t={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,game_type:p.gameType,name:p.name,items:p.items,config:p.config||{},updated_at:'2026-10-19'};window.__workspace.templates.push(t);window.__workspace.writes.push(t);window.__persist();return structuredClone(t);},
fetchGameTemplateById:async(id)=>window.__workspace.templates.find(t=>t.id===id),
updateGameTemplate:async(id,p)=>{if(isActivityDraft(id)){patchActivityDraft(id,p);return;}if(window.__workspace.fail)throw Error('UX점검 update failed');Object.assign(window.__workspace.templates.find(t=>t.id===id)||{},p);window.__persist();}
};
${names.map((n) => `export const ${n}=(...args)=>(functions.${n}|| (async()=>[]))(...args);`).join("\n")}
`;
const auth = `const value={academy:{id:'academy-a',features:{group:true},plan:'paid',deletion_requested_at:null,deletion_scheduled_at:null},profile:{id:'teacher-a'},isStaff:!new URLSearchParams(location.search).has('student'),isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:false,inTrial:false,daysLeft:7},pointUnit:'별'};export const useAuth=()=>value;export const AuthProvider=({children})=>children;`;
const toast = `const run=async(fn)=>{try{await fn();return true}catch(e){console.error(e);return false}};const value={notify:(...a)=>{window.__notices||=[];window.__notices.push(a)},run};export const useToast=()=>value;export const ToastProvider=({children})=>children;`;
const server = await createServer({cacheDir:'node_modules/.vite/qa-remaining-lessons',
  root,
  logLevel: "error",
  plugins: [
    {
      name: "synthetic-workspace",
      enforce: "pre",
      load(id) {
        const p = id.replaceAll("\\", "/");
        if (p.endsWith("/src/lib/api.ts")) return stub;
        if (p.endsWith("/src/context/AuthContext.tsx")) return auth;
        if (p.endsWith("/src/context/ToastContext.tsx")) return toast;
        if (p.endsWith("/src/lib/supabase.ts"))
          return "export const supabase={rpc:async(name)=>({data:name==='my_deletion_request'?null:[],error:null}),channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}})};";
      },
    },
  ],
  server: { hmr: false, host: "127.0.0.1", port: 5367, strictPort: true },
});


let browser,page;const results=[],dialogs=[];const pass=name=>{results.push(name);console.log('PASS',name);};
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});await page.route('https://**/*',route=>route.abort());
 const url='http://127.0.0.1:5367/scripts/games/focus.html?start=',form=()=>page.locator('[data-lesson-edit-form]');
 await page.goto(url+'/dashboard');await page.locator('[data-home-dashboard]').waitFor();
 await page.evaluate(()=>{
  window.__workspace.templates.push({id:'ux-wheel',academy_id:'academy-a',class_id:'class-a',game_type:'wheel',name:'UX점검 저장된 단어 게임',items:[{id:'a',label:'apple'},{id:'b',label:'banana'},{id:'c',label:'cat'}],config:{},updated_at:'2026-10-28'});
  window.__workspace.lessons=[{id:'ux-legacy',academy_id:'academy-a',class_id:'class-a',name:'UX점검 Voca King',word_list_id:'words',level:null,video_url:null,playlist:[{id:'legacy-wheel',gameType:'wheel'}],updated_at:'2026-10-28'},{id:'ux-native',academy_id:'academy-a',class_id:'class-a',name:'UX점검 저장 게임 수업',word_list_id:null,level:null,video_url:null,playlist:[{id:'snapshot-wheel',kind:'game',gameType:'wheel',templateId:'ux-wheel'}],updated_at:'2026-10-28'}];window.__persist();
 });
 await page.goto(url+'/curriculum');await page.getByRole('heading',{name:'UX점검 Voca King',exact:true}).waitFor();
 const edit=async title=>page.getByRole('heading',{name:title,exact:true}).locator('..').locator('..').getByRole('button',{name:'고치기',exact:true}).click();
 await edit('UX점검 Voca King');await form().waitFor();await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);await form().getByRole('button',{name:'취소',exact:true}).click();await form().waitFor({state:'hidden'});assert.equal(dialogs.length,0);pass('legacy Voca King fixture: read/close creates no game, changes no slide, shows no dirty warning');
 await edit('UX점검 Voca King');await form().getByPlaceholder('예: 9월 3주차 - 동물 단어',{exact:true}).fill('UX점검 Voca King 수정');await form().getByRole('button',{name:'취소',exact:true}).click();assert.equal(dialogs.length,1);assert(await form().isVisible());await form().getByRole('button',{name:'저장',exact:true}).click();await form().waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__workspace.lessons.find(l=>l.id==='ux-legacy').name),'UX점검 Voca King 수정');pass('real lesson edit still warns; explicit save clears dirty');
 const beforeRead=await page.evaluate(()=>window.__workspace.writes.length);
 await edit('UX점검 저장 게임 수업');await form().getByText('UX점검 저장된 단어 게임 · 항목 3개',{exact:true}).waitFor();assert.equal(await form().getByText(/단어.*0개|아직 수업 단어장을 고르지/).count(),0);assert.equal(await page.evaluate(()=>window.__workspace.writes.length),beforeRead);await form().getByRole('button',{name:'취소',exact:true}).click();await form().waitFor({state:'hidden'});assert.equal(dialogs.length,1);pass('block-owned saved contents are recognized without a shared word list; read does not mark dirty');
 await page.goto(url+'/dashboard');const homeRow=()=>page.getByRole('heading',{name:'UX점검 저장 게임 수업',exact:true}).locator('..');await homeRow().getByText('활동 1개',{exact:true}).waitFor();
 await page.evaluate(()=>{const lesson=window.__workspace.lessons.find(l=>l.id==='ux-native');lesson.playlist.push({id:'explicit-change',kind:'game',gameType:'wheel',templateId:'ux-wheel'});window.__persist();window.dispatchEvent(new CustomEvent('classbank:lesson-changed',{detail:{academyId:'academy-a',lessonId:lesson.id}}));});await homeRow().getByText('활동 2개',{exact:true}).waitFor();pass('home count refreshes immediately after an explicit lesson-change event');
 // Actual add dialog, success, selected lesson contents and a full browser reload.
 await page.getByRole('heading',{name:'합성 과일',exact:true}).locator('..').locator('..').getByRole('button',{name:'수업에 추가',exact:false}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('combobox').selectOption('ux-native');const beforeNotice=await page.evaluate(()=>(window.__notices||[]).length);await page.evaluate(()=>window.__workspace.failAppend=true);await dialog.getByRole('button',{name:'수업에 추가',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(await page.evaluate(()=>window.__workspace.lessons.find(l=>l.id==='ux-native').playlist.length),2);assert.equal(await page.evaluate(()=>(window.__notices||[]).length),beforeNotice);assert.equal(await dialog.getByRole('combobox').inputValue(),'ux-native');await page.evaluate(()=>window.__workspace.failAppend=false);await dialog.getByRole('button',{name:'수업에 추가',exact:true}).click();await form().waitFor();assert.equal(await page.evaluate(()=>window.__workspace.lessons.find(l=>l.id==='ux-native').playlist.length),3);assert.equal((await page.evaluate(()=>window.__notices||[])).some(n=>String(n[0]).includes('UX점검 저장 게임 수업')),true);pass('failed append does not report success or alter lesson; selected target is retained for retry');
 await page.goto(url+'/dashboard');await homeRow().getByText('활동 3개',{exact:true}).waitFor();pass('Add to lesson succeeds, selected content persists across reload and home count agrees');
 await page.getByRole('heading',{name:'합성 과일',exact:true}).locator('..').locator('..').getByRole('button',{name:'수업에 추가',exact:false}).click();await dialog.getByRole('combobox').selectOption('new');await dialog.getByRole('textbox').fill('UX점검 새 수업');await dialog.getByRole('button',{name:'수업에 추가',exact:true}).click();await form().waitFor();await form().getByRole('button',{name:'취소',exact:true}).click();await form().waitFor({state:'hidden'});assert.equal(dialogs.length,1);await page.goto(url+'/curriculum');await edit('UX점검 새 수업');await form().waitFor();await form().getByRole('button',{name:'취소',exact:true}).click();await form().waitFor({state:'hidden'});assert.equal(dialogs.length,1);pass('newly created lesson reopens and closes without a false unsaved warning');

 await edit('UX점검 새 수업');await form().getByTitle('복제',{exact:true}).first().click();await form().getByRole('button',{name:'취소',exact:true}).click();assert.equal(dialogs.length,2);await form().getByTitle('삭제',{exact:true}).first().click();await form().getByRole('button',{name:'취소',exact:true}).click();assert.equal(dialogs.length,3);pass('explicit slide addition and deletion retain unsaved warnings');
 assert.deepEqual(errors,[]);writeFileSync(resolve(root,'../output/ux-remaining/lesson-results.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,results,dialogs,errors}));
}catch(error){console.error(error);if(page){console.error((await page.locator('body').innerText()).slice(-8000));await page.screenshot({path:resolve(root,'../output/ux-remaining/lesson-failure.png'),fullPage:true});}process.exitCode=1;}finally{await browser?.close();await server.close();}
