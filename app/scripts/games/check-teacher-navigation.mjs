import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
if(new URLSearchParams(location.search).has('populated')){
 classes.push(...registeredClasses);
 window.__workspace.templates.push({id:'lesson-game',academy_id:'academy-a',class_id:null,game_type:'wheel',name:'검증용 돌림판',items:[{id:'a',label:'apple'},{id:'b',label:'cat'}],config:{},updated_at:'2026-10-21'});
 lists[0].name='날씨와 계절 · 검증 자료';
 lists[1].name='일상 표현 · 검증 문장';
 lists.push({...lists[0],id:'third',name:'동물 친구들 · 검증 자료'});
 window.__workspace.lessons=[1,2,3].map(n=>({id:'lesson-'+n,academy_id:'academy-a',class_id:'class-a',name:'영어 놀이 '+n+' · 검증 수업',playlist:[{id:'slide-'+n,kind:'game',gameType:'wheel',templateId:'lesson-game'}],updated_at:'2026-10-21'}));
}
if(new URLSearchParams(location.search).has('long'))lists[0].name='아주 긴 자료 이름과 문장 모음 이름이 여러 줄이어도 읽을 수 있는지 확인합니다 '.repeat(3);
window.__workspace.fail=new URLSearchParams(location.search).has('fail');
const functions={
fetchMyStudentRow:async()=>({class_id:'class-a'}),
wordListKindOf:(list)=>list.kind==='sentence'?'sentence':'word',
updateWordListItems:async(id,items)=>{if(window.__workspace.fail)throw new Error('synthetic word update failure'); const list=lists.find(row=>row.id===id);if(list)list.items=items;},
fetchClasses:async()=>classes,fetchStudentsOfClass:async()=>students,fetchStudentsOfAcademy:async()=>students,
createWordList:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic save failure'); const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,kind:p.kind,items:p.items,updated_at:'now'};(window.__workspace.wordWrites||=[]).push(row);lists.push(row);return row;},
fetchAllWordLists:async()=>{if(window.__workspace.fail)throw new Error('synthetic load failure');return window.__workspace.empty?[]:structuredClone(lists)},fetchAllCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
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
  server: { hmr: false, host: "127.0.0.1", port: 5212, strictPort: true },
});


let browser,page;
try{
 await server.listen();
 browser=await chromium.launch({channel:'chrome',headless:true});
 page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.route('https://**/*',r=>r.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5212/scripts/home/home.html?start=/games/matchup&empty=1');
 const guide=page.locator('[data-game-guide]');
 await guide.getByRole('button',{name:'샘플로 먼저 해보기',exact:false}).click();
 await guide.getByRole('button',{name:'게임 시작',exact:false}).click();
 const controls=page.locator('[data-frame-controls]');
 await page.evaluate(()=>{window.__keptBoard=document.querySelector('[data-game="matchup"]');Element.prototype.requestFullscreen=()=>Promise.reject(new Error('QA denied'));});
 const board=page.locator('[data-game="matchup"]');
 const first=(await board.locator('.matchup-clay__column').first().getByRole('button').first().innerText()).trim();
 const meanings={apple:'사과',banana:'바나나',cat:'고양이',dog:'강아지',sun:'해',book:'책',fish:'물고기',milk:'우유'};
 await board.getByRole('button',{name:first,exact:true}).click();
 await board.getByRole('button',{name:meanings[first],exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.matchup-clay__tile.is-ok').length===2);
 for(const action of ['pause','fullscreen','prepare']){
  if(action==='pause'){await controls.getByRole('button',{name:'잠시 멈춤',exact:true}).click();await page.getByRole('button',{name:'계속하기',exact:true}).click();}
  if(action==='fullscreen'){
   await controls.getByRole('button',{name:'전체화면',exact:true}).click();
   await page.locator('[data-game-fullscreen="true"]').waitFor();
   await page.keyboard.press('Escape');
   await page.locator('[data-game-fullscreen="true"]').waitFor({state:'detached'});
  }
  if(action==='prepare'){
   await controls.getByRole('button',{name:'준비 화면으로',exact:true}).click();
   await page.locator('[data-game-ready-overlay]').getByRole('button',{name:'게임 시작',exact:true}).click();
  }
  assert.equal(await page.locator('.matchup-clay__tile.is-ok').count(),2,action);
  assert(await page.evaluate(()=>window.__keptBoard===document.querySelector('[data-game="matchup"]')),action);
 }
 await controls.getByRole('button',{name:'☰ 메뉴',exact:true}).click();
 const menu=page.getByRole('dialog',{name:'메뉴',exact:true});
 await menu.getByText('소리·화면 도구',{exact:true}).click();
 const sound=menu.getByRole('button',{name:'소리 끄기',exact:true});
 if(await sound.count())await sound.click();
 await page.screenshot({path:resolve(root,'../output/teacher-game-ux/menu-desktop.png')});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:resolve(root,'../output/teacher-game-ux/menu-mobile.png')});
 await menu.getByRole('link',{name:'게임 목록으로 나가기',exact:true}).click();
 await page.waitForURL('**/games');
 await page.getByRole('heading',{name:'게임',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 writeFileSync(resolve(root,'../output/teacher-game-ux/navigation.json'),JSON.stringify({passed:true,matchedTilesPreserved:2,sameBoard:true,pause:true,fullscreenDeniedAndEscape:true,preparationReturn:true,gameListExit:true,errors},null,2));
 console.log('PASS actual matched tiles and board preserved across pause/fullscreen/preparation; list exit and optional tools accessible');
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();await server.close();}
