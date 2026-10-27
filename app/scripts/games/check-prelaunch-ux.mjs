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
const classes=registeredClasses;
const students=[{id:'alice',name:'Alice',academy_id:'academy-a',class_id:'class-a'},{id:'bob',name:'Bob',academy_id:'academy-a',class_id:'class-a'}];
const lists=[{id:'words',academy_id:'academy-a',class_id:'class-a',kind:'word',name:'합성 과일',updated_at:'2026-10-19',items:[{id:'apple',word:'apple',meaning:'사과',image_url:'/word-bank-images/apple.webp',category:'fruit'},{id:'banana',word:'banana',meaning:'바나나',image_url:'/word-bank-images/banana.webp',category:'fruit'},{id:'cat',word:'cat',meaning:'고양이',image_url:'/word-bank-images/cat.webp',category:'animal'},{id:'dog',word:'dog',meaning:'강아지',image_url:null,category:'animal'}]},{id:'sentences',academy_id:'academy-a',class_id:'class-a',kind:'sentence',name:'합성 문장',updated_at:'2026-10-19',items:[{id:'s',word:'I like cats.',meaning:'나는 고양이를 좋아해요.',image_url:null}]}];
window.__workspace={templates:[],writes:[],fail:false,empty:new URLSearchParams(location.search).has('empty')};
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
const server = await createServer({cacheDir:'node_modules/.vite/qa-check-prelaunch-ux',
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
  server: { hmr: false, host: "127.0.0.1", port: 5334, strictPort: true },
});


let browser,page;
try{
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>process.env.UX_FONTS&&['fonts.googleapis.com','fonts.gstatic.com'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const url='http://127.0.0.1:5334/scripts/games/focus.html?start=',guide=()=>page.locator('[data-game-guide]');
 const {GAME_CATALOG}=await server.ssrLoadModule('/src/lib/gameCatalog.ts');const {guideKinds}=await server.ssrLoadModule('/src/lib/gameGuide.ts');let checked=0;
 for(const game of GAME_CATALOG.filter(g=>g.type!=='quizshow'&&!process.env.UX_FOCUS)){
  await page.goto(url+game.path);await guide().waitFor();const cards=guide().locator('button').filter({hasText:/샘플로 먼저 해보기|단어로 만들기|문장으로 만들기|학생·팀 이름으로 만들기/});assert.equal(await cards.count(),4);
  for(const [i,kind] of ['sample','word','sentence','names'].entries())assert.equal(await cards.nth(i).isDisabled(),!guideKinds(game.type).includes(kind));
  await cards.nth(0).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('[data-play-mode]').getAttribute('data-play-mode'),'prepare');assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);await page.locator('[data-game-ready-overlay]').getByRole('button',{name:'게임 시작',exact:true}).waitFor();await page.locator('[data-game-ready-overlay]').getByRole('button',{name:'게임 시작',exact:true}).click();await page.locator('[data-play-mode="play"]').waitFor();assert.equal(await page.locator('[data-game-ready-overlay]').count(),0);assert.equal(await page.locator('[data-initial-game-start]:visible').count(),0);checked++;console.log('sample ready and single start',game.type);
 }
 await page.goto(url+'/games/wheel');await guide().getByRole('button',{name:'학생·팀 이름으로 만들기',exact:false}).click();await guide().getByLabel('항목',{exact:true}).first().fill('칭찬 도장');await guide().getByRole('button',{name:'항목 추가',exact:false}).click();await guide().getByLabel('항목',{exact:true}).nth(1).fill('한 번 더');
 if(process.env.UX_FONTS)await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:resolve(root,'../output/prelaunch-guide-desktop.png')});await guide().getByRole('button',{name:'이전',exact:true}).click();await guide().getByRole('button',{name:'학생·팀 이름으로 만들기',exact:false}).click();assert.equal(await guide().getByLabel('항목',{exact:true}).first().inputValue(),'칭찬 도장');
 await guide().getByRole('button',{name:'완료',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);assert.equal(await page.locator('[data-play-mode]').getAttribute('data-play-mode'),'prepare');
 await page.locator('[data-frame-controls]').getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'내용 수정',exact:true}).click();assert.equal(await guide().getAttribute('data-guide-step'),'1');assert.equal(await guide().getByLabel('항목',{exact:true}).first().inputValue(),'칭찬 도장');await guide().getByRole('button',{name:'완료',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.locator('[data-frame-controls]').getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 저장',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__workspace.writes.length),1);
 await page.getByRole('link',{name:'내 게임',exact:true}).last().click();await page.locator('[data-my-games]').waitFor();assert.equal(await page.locator('[data-my-games] article').count(),1);await page.screenshot({path:resolve(root,'../output/prelaunch-my-games-desktop.png')});await page.locator('[data-my-games]').getByRole('link',{name:'내용 수정',exact:true}).click();await guide().getByRole('button',{name:'완료',exact:true}).waitFor();assert.equal(await guide().getByLabel('항목',{exact:true}).first().inputValue(),'칭찬 도장');
 await guide().getByLabel('항목',{exact:true}).first().fill('수정한 항목');await guide().getByRole('button',{name:'완료',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__workspace.templates.find(t=>t.id===window.__workspace.writes[0].id).items[0].label),'칭찬 도장');await page.locator('[data-frame-controls]').getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 저장',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__workspace.writes.length),1);assert.equal(await page.evaluate(()=>window.__workspace.templates.find(t=>t.id===window.__workspace.writes[0].id).items[0].label),'수정한 항목');
 await page.goto(url+'/games/quiz');await guide().getByRole('button',{name:'단어로 만들기',exact:false}).click();await guide().getByRole('button',{name:'완료',exact:true}).click();await guide().locator('[data-guide-error]').waitFor();await guide().getByRole('button',{name:'내 단어장 불러오기',exact:false}).click();await guide().getByRole('button',{name:/합성 과일/}).click();await guide().getByRole('button',{name:'완료',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.goto(url+'/games/bomb');await guide().getByRole('button',{name:'샘플로 먼저 해보기',exact:false}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.evaluate(()=>{window.__delays=[];const old=window.__clock.setTimeout;window.__clock.setTimeout=(fn,ms)=>{window.__delays.push(ms);return old(fn,ms);};});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.__delays.filter(ms=>ms>=15000&&ms<=60000).length),0);await page.locator('[data-game-ready-overlay]').getByRole('button',{name:'게임 시작',exact:true}).click();await page.waitForFunction(()=>window.__delays.some(ms=>ms>=15000&&ms<=60000));assert.equal(await page.locator('[data-game-ready-overlay]').count(),0);
 await page.locator('[data-frame-controls]').getByRole('button',{name:'전체화면',exact:true}).click();await page.getByRole('button',{name:'전체화면 종료',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('button',{name:'전체화면',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.goto(url+'/games/unscramble');await guide().waitFor();assert.equal(await guide().getByRole('button',{name:'단어로 만들기',exact:false}).isDisabled(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:resolve(root,'../output/prelaunch-guide-mobile.png')});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,sampleGames:checked,twoStep:true,directAndBack:true,savedEditNoAutoWrite:true,sameIdSave:true,import:true,invalidInput:true,singleBombStart:true,fullscreenEscape:true,mobile:true,errors}));
}catch(e){console.error(e);if(page){console.error((await page.locator('body').innerText()).slice(-5000));await page.screenshot({path:resolve(root,'../output/prelaunch-failure.png'),fullPage:true});}process.exitCode=1;}finally{await browser?.close();await server.close();}
