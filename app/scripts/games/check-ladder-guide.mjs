import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const names = [
  ...readFileSync(resolve(root, "src/lib/api.ts"), "utf8").matchAll(
    /export (?:async )?function (\w+)|export const (\w+)/g,
  ),
].map((m) => m[1] || m[2]);
const stub = `
import { isActivityDraft, patchActivityDraft } from '/src/lib/quickActivity.ts';
const academy={id:'academy-a',features:{group:true,homework:true},plan:'paid'};
const registeredClasses=[{id:'class-a',academy_id:'academy-a',name:'합성 A반'},{id:'class-b',academy_id:'academy-a',name:'합성 B반'}];
const classes=[];
const students=[{id:'alice',name:'Alice'},{id:'bob',name:'Bob'},{id:'cara',name:'Cara'}];
const lists=[{id:'words',academy_id:'academy-a',class_id:'class-a',kind:'word',name:'합성 과일',updated_at:'2026-10-19',items:[{id:'apple',word:'apple',meaning:'사과',image_url:'/word-bank-images/apple.webp',category:'fruit'},{id:'banana',word:'banana',meaning:'바나나',image_url:'/word-bank-images/banana.webp',category:'fruit'},{id:'cat',word:'cat',meaning:'고양이',image_url:'/word-bank-images/cat.webp',category:'animal'},{id:'dog',word:'dog',meaning:'강아지',image_url:null,category:'animal'}]},{id:'sentences',academy_id:'academy-a',class_id:'class-a',kind:'sentence',name:'합성 문장',updated_at:'2026-10-19',items:[{id:'s',word:'I like cats.',meaning:'나는 고양이를 좋아해요.',image_url:null}]}];
window.__workspace={templates:[],writes:[],fail:false,empty:new URLSearchParams(location.search).has('empty')};
if(new URLSearchParams(location.search).has('student'))window.__workspace.templates.push({id:'student-game',academy_id:'academy-a',class_id:'class-a',game_type:'wheel',name:'학생용 저장 게임',items:[{id:'a',label:'apple'},{id:'b',label:'cat'}],config:{}});
if(new URLSearchParams(location.search).has('saved'))window.__workspace.templates.push({id:'original-game',academy_id:'academy-a',class_id:null,game_type:'wheel',name:'원본 저장 게임',items:[{id:'original',label:'ORIGINAL'}],config:{}});
const functions={
fetchMyStudentRow:async()=>({class_id:'class-a'}),
wordListKindOf:(list)=>list.kind==='sentence'?'sentence':'word',
updateWordListItems:async(id,items)=>{if(window.__workspace.fail)throw new Error('synthetic word update failure'); const list=lists.find(row=>row.id===id);if(list)list.items=items;},
fetchClasses:async()=>classes,fetchStudentsOfClass:async()=>students,fetchStudentsOfAcademy:async()=>students,
createWordList:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic save failure'); const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,kind:p.kind,items:p.items,updated_at:'now'};(window.__workspace.wordWrites||=[]).push(row);lists.push(row);return row;},
fetchAllWordLists:async()=>window.__workspace.empty?[]:structuredClone(lists),fetchAllCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
fetchCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
fetchCurriculumLessonById:async(id)=>(window.__workspace.lessons||[]).find(x=>x.id===id),
createCurriculumLesson:async(p)=>{const l={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,playlist:p.playlist,updated_at:'now'};(window.__workspace.lessons||=[]).push(l);return l;},
appendActivityToLesson:async(l,s)=>{l.playlist.push(s)},
fetchWordLists:async(_a,_c,k)=>structuredClone(k==='all'?lists:lists.filter(x=>x.kind===k)),
fetchGameTemplates:async(_a,_c,type)=>window.__workspace.templates.filter(x=>x.game_type===type),
createGameTemplate:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic failure');const t={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,game_type:p.gameType,name:p.name,items:p.items,config:p.config||{},updated_at:'2026-10-19'};window.__workspace.templates.push(t);window.__workspace.writes.push(t);return t;},
fetchGameTemplateById:async(id)=>window.__workspace.templates.find(t=>t.id===id),
updateGameTemplate:async(id,p)=>{if(isActivityDraft(id))patchActivityDraft(id,p);else Object.assign(window.__workspace.templates.find(t=>t.id===id)||{},p)}
};
${names.map((n) => `export const ${n}=(...args)=>(functions.${n}|| (async()=>[]))(...args);`).join("\n")}
`;
const auth = `const value={academy:{id:'academy-a',features:{group:true},plan:'paid',deletion_requested_at:null,deletion_scheduled_at:null},profile:{id:'teacher-a'},isStaff:!new URLSearchParams(location.search).has('student'),isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:false,inTrial:false,daysLeft:7},pointUnit:'별'};export const useAuth=()=>value;export const AuthProvider=({children})=>children;`;
const toast = `const run=async(fn)=>{try{await fn();return true}catch(e){console.error(e);return false}};const value={notify:()=>{},run};export const useToast=()=>value;export const ToastProvider=({children})=>children;`;
const server = await createServer({
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
  server: { hmr: false, host: "127.0.0.1", port: 5198, strictPort: true },
});


let browser,page;
try {
 const {ladderResultDraft,ladderSlots,shuffledResultIds}=await server.ssrLoadModule('/src/lib/ladderSetup.ts');
 const legacy=ladderResultDraft('상품1\n상품2\n\n꽝');assert.equal(ladderSlots(legacy,6).length,6);assert.equal(legacy.slots[2].label,'');assert.equal(ladderSlots(legacy,6)[5].label,'');
 assert.deepEqual(ladderResultDraft(JSON.stringify({slots:[{label:'Keep',miss:true}],order:'random'})),{slots:[{label:'Keep',miss:true}],order:'random'});
 const original=[{id:'a',label:'1'},{id:'b',label:'2'},{id:'c',label:'3'}],before=JSON.stringify(original);assert.deepEqual(shuffledResultIds(original,()=>0),['b','c','a']);assert.equal(JSON.stringify(original),before);
 const {guideSample,guideProblem}=await server.ssrLoadModule('/src/lib/gameGuide.ts');
 const sample=guideSample('ladder',{game_type:'ladder',items:[],config:{}});assert.equal(sample.items.length,sample.config.results.length);assert.equal(guideProblem({game_type:'ladder',...sample}),null);
 assert.equal(guideProblem({game_type:'ladder',items:original,config:{results:original.slice(1)}}),'ladderIncomplete');assert.equal(guideProblem({game_type:'ladder',items:original,config:{}}),null);
 console.log('ok legacy multiline recovery, missing slots, non-mutating shuffle, sample readiness, legacy config fallback');
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1280,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 const fixture='http://127.0.0.1:5198/scripts/games/focus.html?start=/games/ladder';const guide=()=>page.locator('[data-game-guide]');
 await page.goto(fixture);await page.evaluate(()=>sessionStorage.clear());await page.reload();
 await guide().getByRole('button',{name:'학생·팀 이름으로 만들기',exact:false}).click();await page.locator('[data-guide-step="1"]').waitFor();
 // Reproduce a six-person roster and only two prizes using the old recovery field.
 await page.evaluate(()=>{
 sessionStorage.setItem('classbank:editor-field:teacher-a:academy-a:guide:ladder:names:rows',JSON.stringify(['민지','지우','하나','소율','윤슬','에스더'].map(n=>[n])));
 sessionStorage.setItem('classbank:editor-field:teacher-a:academy-a:guide:ladder:extra','상품1\n상품2');
 });
 await page.reload();await guide().getByRole('button',{name:'학생·팀 이름으로 만들기',exact:false}).click();
 await guide().locator('[data-ladder-result="5"]').waitFor();assert.equal(await guide().locator('[data-ladder-result]').count(),6);
 await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByRole('alert').getByText(/결과를 4개 더/).waitFor();assert.equal(await page.locator(':focus').getAttribute('data-ladder-result'),'2');
 assert.equal(await guide().getAttribute('data-guide-step'),'1');
 await guide().getByRole('button',{name:'빈 결과를 모두 꽝으로 채우기',exact:true}).click();assert.equal(await guide().getByRole('checkbox',{checked:true}).count(),4);
 await guide().getByRole('checkbox',{name:'결과 3은 꽝',exact:true}).uncheck();await guide().getByLabel('결과 3',{exact:true}).fill('발표하기');
 await guide().getByRole('checkbox',{name:'결과 3은 꽝',exact:true}).check();await guide().getByRole('checkbox',{name:'결과 3은 꽝',exact:true}).uncheck();assert.equal(await guide().getByLabel('결과 3',{exact:true}).inputValue(),'발표하기');
 await guide().getByRole('button',{name:'다음',exact:true}).click();await page.locator('[data-guide-step="3"]').waitFor();await guide().getByRole('button',{name:'게임 시작',exact:false}).click();
 const board=page.locator('[data-ladder-results]');await board.waitFor();assert.deepEqual(await board.locator(':scope > div').allTextContents(),['상품1','상품2','발표하기','꽝','꽝','꽝']);
 assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);
 console.log('ok six result fields, explicit missing count and focus, fill blanks, reversible No prize, Next -> native ordered game without saving');
 // Resume without losing text, increase/decrease participants and restore hidden results.
 await page.reload();await guide().getByRole('button',{name:'학생·팀 이름으로 만들기',exact:false}).click();await guide().getByLabel('결과 3',{exact:true}).waitFor();assert.equal(await guide().getByLabel('결과 3',{exact:true}).inputValue(),'발표하기');
 await guide().getByRole('button',{name:'항목 추가',exact:false}).click();await guide().getByLabel('학생·팀 이름',{exact:true}).last().fill('새 친구');assert.equal(await guide().locator('[data-ladder-result]').count(),7);await guide().getByLabel('결과 7',{exact:true}).fill('마지막 상품');
 await guide().getByRole('button',{name:'삭제 7',exact:true}).click();assert.equal(await guide().locator('[data-ladder-result]').count(),6);await guide().getByRole('button',{name:'항목 추가',exact:false}).click();await guide().getByLabel('학생·팀 이름',{exact:true}).last().fill('새 친구');assert.equal(await guide().getByLabel('결과 7',{exact:true}).inputValue(),'마지막 상품');
 await guide().getByRole('radio',{name:'무작위로 섞기',exact:true}).check();
 await page.setViewportSize({width:390,height:844});await guide().getByRole('radio',{name:'무작위로 섞기',exact:true}).scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:resolve(root,'../output/ladder-results-mobile.png'),fullPage:true});
 await page.reload();await guide().getByRole('button',{name:'학생·팀 이름으로 만들기',exact:false}).click();assert(await guide().getByRole('radio',{name:'무작위로 섞기',exact:true}).isChecked());await guide().getByRole('button',{name:'다음',exact:true}).click();await page.locator('[data-guide-step="3"]').waitFor();await guide().getByRole('button',{name:'게임 시작',exact:false}).click();await board.waitFor();
 // Deterministic randomness only in the test: every result must be retained and source order stays untouched.
 await page.evaluate(()=>{Math.random=()=>0;});await page.getByRole('button',{name:'한 명씩 결과 보기',exact:false}).click();
 const labels=await board.locator(':scope > div').allTextContents();assert.deepEqual(labels,['상품2','발표하기','꽝','꽝','꽝','마지막 상품','상품1']);
 const draft=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('activity-draft:teacher-a:academy-a:ladder')));assert.equal(draft.config.ladderResultOrder,'random');assert.deepEqual(draft.config.results.map(r=>r.label),['상품1','상품2','발표하기','꽝','꽝','꽝','마지막 상품']);
 await page.setViewportSize({width:1024,height:900});assert.deepEqual(await board.locator(':scope > div').allTextContents(),labels);assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);assert.deepEqual(errors,[]);
 console.log('ok recovery, result count resizes/restores, mobile, random placement stable across resize, saved config keeps original order, no writes/errors');
 await page.getByRole('button',{name:'민지',exact:true}).click();await page.locator('[data-ladder-outcome]').waitFor();assert.match(await page.locator('[data-ladder-outcome]').first().innerText(),/민지\s*→\s*발표하기/);
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 설정·수정',exact:true}).click();await page.locator('[data-preparation-submit] summary').click();await page.getByRole('textbox',{name:'활동 이름 (선택)',exact:true}).fill('사다리 저장 검증');await page.getByRole('button',{name:'내 활동으로 저장',exact:true}).click();await page.waitForFunction(()=>window.__workspace.writes.length===1);
 const saved=await page.evaluate(()=>structuredClone(window.__workspace.writes[0]));assert.deepEqual(saved.config.results,draft.config.results);assert.equal(saved.config.ladderResultOrder,'random');
 await page.locator('[data-game-preparation] summary').click();await page.getByRole('button',{name:'저장한 게임 불러오기',exact:true}).click();await page.getByRole('button',{name:'사다리 저장 검증',exact:true}).click();await board.waitFor();assert.deepEqual((await board.locator(':scope > div').allTextContents()).sort(),labels.slice().sort());assert.deepEqual(errors,[]);
 console.log('ok shuffled endpoint matches revealed outcome; explicit save/reopen preserves results and placement mode');
 // A short ladder must remain centered even when the frame scales the whole game down.
 await page.setViewportSize({width:2048,height:809});await page.goto(fixture);await guide().getByRole('button',{name:'샘플로 먼저 해보기',exact:false}).click();await guide().getByRole('button',{name:'게임 시작',exact:false}).click();
 const centered=async()=>{await page.waitForFunction(()=>{const el=document.querySelector('[data-ladder-stage]');if(!el)return false;const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.width>0&&Math.abs((a.left+a.right-b.left-b.right)/2)<3;});};
 await centered();
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'전체화면',exact:true}).click();await page.locator('[data-game-fullscreen="true"]').waitFor();await centered();
 await page.screenshot({path:resolve(root,'../output/ladder-centered-wide.png'),fullPage:true});
 await page.setViewportSize({width:1280,height:800});await centered();assert.deepEqual(errors,[]);console.log('ok six-column board centered in wide play/fullscreen and after resize');
 const fitResults=async(width,height)=>{
   await page.setViewportSize({width,height});await centered();
   const svg=page.locator('[data-ladder-stage] svg');const before=await svg.boundingBox();
   await page.getByRole('button',{name:'한 번에 결과 보기',exact:true}).click();
   await page.waitForFunction(()=>document.querySelectorAll('[data-ladder-outcome]').length===6);
   await page.waitForFunction(()=>{
     const frame=document.querySelector('.game-fs[data-game="ladder"]');
     const board=frame?.querySelector('[data-ladder-stage]');const outcomes=frame?.querySelector('[data-ladder-outcomes]');
     if(!frame||!board||!outcomes)return false;
     const a=board.getBoundingClientRect(),b=outcomes.getBoundingClientRect(),f=frame.getBoundingClientRect();
     return a.top>=f.top&&b.bottom<=f.bottom&&a.left>=f.left&&a.right<=f.right;
   });
   const after=await svg.boundingBox();assert(after.width<=before.width*1.05,'result reveal must not enlarge the board');await centered();
   await page.screenshot({path:resolve(root,`../output/ladder-results-fit-${width}.png`),fullPage:true});
   await page.locator('[data-ladder-outcomes]').getByRole('button',{name:'다시하기',exact:true}).click();
 };
 await fitResults(3407,1346);await fitResults(2048,809);await fitResults(1280,800);await page.getByRole('button',{name:'전체화면 종료',exact:true}).click();await page.locator('[data-game-fullscreen="false"]').waitFor();await fitResults(2048,809);assert.deepEqual(errors,[]);console.log('ok reveal-all keeps board and all six outcomes within viewport without sudden enlargement in wide/laptop fullscreen and normal play');


}catch(error){console.error(error);if(page){console.error((await page.locator('body').innerText()).slice(-7000));await page.screenshot({path:resolve(root,'../output/ladder-guide-failure.png'),fullPage:true});}process.exitCode=1;}
finally{await browser?.close();await server.close();}
