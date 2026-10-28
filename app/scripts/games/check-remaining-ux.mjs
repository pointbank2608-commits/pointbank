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
appendActivityToLesson:async(l,s)=>{if(window.__workspace.fail)throw Error('UX점검 append failed');window.__workspace.lessons.find(row=>row.id===l.id).playlist.push(s);window.__persist();},
fetchWordLists:async(_a,_c,k='all')=>structuredClone(k==='all'?lists:lists.filter(x=>x.kind===k)),
fetchGameTemplates:async(_a,_c,type)=>window.__workspace.templates.filter(x=>x.game_type===type),
createGameTemplate:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic failure');const t={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,game_type:p.gameType,name:p.name,items:p.items,config:p.config||{},updated_at:'2026-10-19'};window.__workspace.templates.push(t);window.__workspace.writes.push(t);window.__persist();return structuredClone(t);},
fetchGameTemplateById:async(id)=>window.__workspace.templates.find(t=>t.id===id),
updateGameTemplate:async(id,p)=>{if(isActivityDraft(id)){patchActivityDraft(id,p);return;}if(window.__workspace.fail)throw Error('UX점검 update failed');Object.assign(window.__workspace.templates.find(t=>t.id===id)||{},p);window.__persist();}
};
${names.map((n) => `export const ${n}=(...args)=>(functions.${n}|| (async()=>[]))(...args);`).join("\n")}
`;
const auth = `const value={academy:{id:'academy-a',features:{group:true},plan:'paid',deletion_requested_at:null,deletion_scheduled_at:null},profile:{id:'teacher-a'},isStaff:!new URLSearchParams(location.search).has('student'),isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:false,inTrial:false,daysLeft:7},pointUnit:'별'};export const useAuth=()=>value;export const AuthProvider=({children})=>children;`;
const toast = `const run=async(fn)=>{try{await fn();return true}catch(e){console.error(e);return false}};const value={notify:()=>{},run};export const useToast=()=>value;export const ToastProvider=({children})=>children;`;
const server = await createServer({cacheDir:'node_modules/.vite/qa-remaining-ux',
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
  server: { hmr: false, host: "127.0.0.1", port: 5366, strictPort: true },
});


let browser,page;const results=[];const pass=name=>{results.push(name);console.log('PASS',name);};
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',route=>route.abort());
 await page.addInitScript(()=>{window.__musicStarts=0;HTMLMediaElement.prototype.play=function(){window.__musicStarts++;return Promise.resolve();};});
 const url='http://127.0.0.1:5366/scripts/games/focus.html?start=',guide=()=>page.locator('[data-game-guide]'),closed=()=>page.getByRole('dialog').waitFor({state:'hidden'});
 for(const id of ['balloonpop','wordfishing','wordtrain','grammardetective'].filter(id=>!process.env.UX_NATIVE_ONLY||id===process.env.UX_NATIVE_ONLY)){
  await page.goto(url+'/games/'+id);await guide().waitFor();await guide().getByRole('button',{name:['wordtrain','grammardetective'].includes(id)?'문장으로 만들기':'단어로 만들기',exact:false}).click();
  assert.equal(await page.getByRole('button',{name:'설정 적용 · 게임 다시 준비',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'새 게임으로 저장',exact:true}).count(),0);
  assert.equal(await page.getByRole('combobox',{name:'제한 시간',exact:true}).isVisible().catch(()=>false),false);
  if(id==='grammardetective'){
   await page.locator('.ad-edit-card textarea').first().fill('He go home.');await page.locator('.ad-edit-card input').first().fill('He goes home.');
  }else{
   const input=page.getByRole('textbox',{name:id==='wordtrain'?'문장 입력':'단어 입력',exact:true});await input.fill('');await guide().getByRole('button',{name:'완료',exact:true}).click();assert(await guide().isVisible());await page.locator('.ad-edit-errors').waitFor();
   await input.fill(id==='wordtrain'?'I like cats.\nWe like dogs.':'apple / 사과\nbanana / 바나나\ncat / 고양이\ndog / 개');
  }
  await guide().getByRole('button',{name:'완료',exact:true}).click();await closed();assert.equal(await page.locator('[data-play-mode]').getAttribute('data-play-mode'),'prepare');assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);assert.equal(await page.evaluate(()=>window.__musicStarts),0);await page.locator('[data-game-ready-overlay]').getByRole('button',{name:'게임 시작',exact:true}).click();await page.locator('[data-play-mode=play]').waitFor();if(id==='grammardetective'){await page.locator('.ad-evidence').getByRole('button',{name:'go',exact:true}).click();await page.locator('.ad-choices').getByRole('button',{name:'goes',exact:true}).click();await page.locator('.ad-review .ad-learned').getByText('He goes home.',{exact:true}).waitFor();pass('custom grammar sentence retains correct range selection and judging');}pass(id+': one Done applies valid latest input, no auto-save or auto-start');
 }
 await page.goto(url+'/games/passball');await guide().getByRole('button',{name:'샘플로 먼저 해보기',exact:false}).click();await closed();await page.locator('[data-game-ready-overlay]').getByRole('button',{name:'게임 시작',exact:true}).click();await page.getByText('음악이 흐르는 동안 공을 돌리세요… 언제 멈출지 몰라요!',{exact:true}).waitFor();
 const ball=page.locator('.pb-pass');await ball.evaluate(el=>el.dataset.qaRuntime='same-ball');const beforeMusic=await page.evaluate(()=>window.__musicStarts);
 await page.locator('[data-frame-controls]').getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 저장',exact:true}).click();await closed();assert.equal(await page.locator('[data-play-mode]').getAttribute('data-play-mode'),'play');assert.equal(await ball.getAttribute('data-qa-runtime'),'same-ball');assert.equal(await page.locator('[data-game-ready-overlay]').count(),0);assert.equal(await page.evaluate(()=>window.__musicStarts),beforeMusic);assert.equal(await page.evaluate(()=>window.__workspace.writes.length),1);pass('passball: save preserves active DOM, phase, outer play state and one music instance');
 await page.screenshot({path:resolve(root,'../output/ux-remaining/passball-after-save.png')});
 // A second save updates the same saved game; copy remains an explicit choice.
 await page.locator('[data-frame-controls]').getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 저장',exact:true}).click();await closed();assert.equal(await page.evaluate(()=>window.__workspace.writes.length),1);pass('repeat Save updates the existing destination');
 await page.locator('[data-frame-controls]').getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('dialog').locator('[data-game-save-options] summary:visible').click();await page.getByLabel('새 이름으로 저장',{exact:true}).check();const copyName=page.getByRole('dialog').getByRole('textbox',{name:'활동 이름 (선택)',exact:true});await copyName.fill('UX점검 공 돌리기 사본');
 await page.evaluate(()=>window.__workspace.fail=true);await page.getByRole('button',{name:'게임 저장',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await copyName.inputValue(),'UX점검 공 돌리기 사본');assert.equal(await page.evaluate(()=>window.__workspace.writes.length),1);await page.evaluate(()=>window.__workspace.fail=false);await page.getByRole('button',{name:'게임 저장',exact:true}).click();await closed();assert.equal(await page.evaluate(()=>window.__workspace.writes.length),2);assert.equal(await ball.getAttribute('data-qa-runtime'),'same-ball');pass('failed Save preserves inputs; retry and Save as new name preserve original and active game');
 await page.locator('[data-frame-controls]').getByRole('button',{name:'잠시 멈춤',exact:true}).click();await page.locator('[data-game-ready-overlay]').getByRole('button',{name:/계속하기/}).waitFor();await page.locator('[data-frame-controls]').getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 저장',exact:true}).click();await closed();await page.locator('[data-game-ready-overlay]').getByRole('button',{name:/계속하기/}).waitFor();assert.equal(await ball.getAttribute('data-qa-runtime'),'same-ball');pass('saving a paused game keeps it paused');
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('link',{name:'게임 목록으로 나가기',exact:true}).click();await page.goto(url+'/my-games');const saved=page.locator('[data-my-games] article').filter({hasText:'UX점검 공 돌리기 사본'});await saved.waitFor();await saved.getByRole('link',{name:'내용 수정',exact:true}).click();await guide().waitFor();const countBefore=await page.evaluate(()=>window.__workspace.writes.length);await guide().getByRole('button',{name:'완료',exact:true}).click();await closed();assert.equal(await page.evaluate(()=>window.__workspace.writes.length),countBefore);pass('saved game reopens with its content and Done does not save again');

 await page.goto(url+'/games/feedmonster');await guide().getByRole('button',{name:'단어로 만들기',exact:false}).click();await guide().getByRole('button',{name:'자세히 설정',exact:true}).click();await page.locator('.sb-editor').waitFor();const answer=page.getByLabel('정답 단어·표현',{exact:true}).first();await answer.fill('');await page.getByRole('dialog').getByRole('button',{name:'완료',exact:true}).click();await page.locator('.sb-validation').waitFor();await answer.fill('apple');const beforeStory=await page.evaluate(()=>window.__workspace.writes.length);await page.getByRole('dialog').getByRole('button',{name:'완료',exact:true}).click();await closed();assert.equal(await page.locator('[data-play-mode]').getAttribute('data-play-mode'),'prepare');assert.equal(await page.evaluate(()=>window.__workspace.writes.length),beforeStory);pass('shared StoryEditor: invalid required answer remains editable; one Done applies without saving or starting');

 await page.goto(url+'/games/timer');await guide().getByRole('button',{name:'학생·팀 이름으로 만들기',exact:false}).click();await guide().locator('input').first().fill('UX점검 Alice');assert.equal(await page.locator('[data-game-existing-settings]:visible').count(),0);await guide().getByRole('button',{name:'완료',exact:true}).click();await closed();assert.equal(await page.locator('[data-play-mode]').getAttribute('data-play-mode'),'prepare');pass('timer: names remain game content; optional timing and design controls are separate');
 await page.goto(url+'/games/mathgen');await guide().getByRole('button',{name:'기본',exact:false}).click();assert.equal(await page.locator('[data-game-existing-settings]:visible').count(),0);await guide().getByRole('button',{name:'완료',exact:true}).click();await closed();assert.equal(await page.locator('[data-play-mode]').getAttribute('data-play-mode'),'prepare');pass('built-in defaults complete with no optional editor and no auto-start');
 assert.deepEqual(errors,[]);writeFileSync(resolve(root,'../output/ux-remaining/game-results.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,results,errors}));
}catch(error){console.error(error);if(page){console.error((await page.locator('body').innerText()).slice(-7000));await page.screenshot({path:resolve(root,'../output/ux-remaining/failure.png'),fullPage:true});}process.exitCode=1;}finally{await browser?.close();await server.close();}
