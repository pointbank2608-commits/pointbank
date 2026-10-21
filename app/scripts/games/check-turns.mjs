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
  server: { hmr: false, host: "127.0.0.1", port: 5201, strictPort: true },
});


let browser,page;
try {
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('browser error',e.message);});
 const fixture='http://127.0.0.1:5201/scripts/home/home.html';
 const guide=()=>page.locator('[data-game-guide]');const card=()=>page.locator('[data-turn-display]');
 const sample=async(type)=>{await page.goto(fixture+'?start=/games/'+type+'&empty=1');await guide().getByRole('button',{name:'샘플로 먼저 해보기',exact:false}).click();await guide().getByRole('button',{name:'게임 시작',exact:false}).click();await page.locator('[data-play-mode="play"]').waitFor();};
 const people=async()=>{await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'참여자·팀·순서',exact:true}).click();await page.getByLabel('임시 참여자',{exact:false}).fill('민지\n지우\n소연');await page.getByRole('checkbox',{name:'개인·팀 순서로 진행 (해제하면 자유 참여)',exact:true}).check();await page.getByRole('button',{name:'여기서 시작',exact:true}).first().click();await page.getByRole('button',{name:'닫기',exact:true}).click();};
 const current=async()=>card().locator('[data-turn-current]').innerText();
 const expectCurrent=async(name)=>page.waitForFunction(name=>document.querySelector('[data-turn-current]')?.textContent===name,name);
 const {GAME_CATALOG:catalog}=await server.ssrLoadModule('/src/lib/gameCatalog.ts');const {gamePreparation}=await server.ssrLoadModule('/src/lib/gamePreparation.ts');
 const manual=catalog.filter(g=>gamePreparation(g.type).manualTurns&&g.type!=='bomb');
 for(const game of process.env.TURN_FOCUS?[]:manual){await sample(game.type);await people();assert.equal(await current(),'민지');assert.equal(await card().locator('[data-turn-next]').innerText(),'지우');await card().locator('[data-turn-advance]').click();await expectCurrent('지우');await page.waitForTimeout(270);await card().locator('[data-turn-advance]').dblclick();await expectCurrent('소연');await page.waitForTimeout(270);await card().locator('[data-turn-advance]').click();await expectCurrent('민지');assert.equal(await card().count(),1);assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);console.log('ok manual',game.type);}
 await sample('bomb');await people();await expectCurrent('민지');assert.equal(await card().locator('[data-turn-advance]').count(),0);
 await page.evaluate(()=>{const original=window.__clock.setTimeout;window.__bombTimers=0;window.__clock.setTimeout=(fn,ms)=>{if(ms>1000){window.__bombTimers++;window.__explode=fn;}return original(fn,ms);};});
 await page.getByRole('button',{name:'폭탄 돌리기 시작',exact:true}).click();await card().getByRole('button',{name:'지우에게 넘기기',exact:false}).click();await expectCurrent('지우');assert.equal(await card().locator('[data-turn-next]').innerText(),'소연');assert.equal(await page.evaluate(()=>window.__bombTimers),1);await page.waitForTimeout(270);await card().locator('[data-turn-advance]').dblclick();await expectCurrent('소연');assert.equal(await page.evaluate(()=>window.__bombTimers),1);
 await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:resolve(root,'../output/turn-bomb-desktop.png')});
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('link',{name:'게임메뉴',exact:true}).waitFor();await page.getByRole('button',{name:'계속하기',exact:true}).click();await expectCurrent('소연');
 await page.evaluate(()=>window.__explode());await page.getByText('소연',{exact:true}).last().waitFor();assert.equal(await card().locator('[data-turn-advance]').count(),0);
 await page.getByRole('button',{name:'다시 하기',exact:true}).click();await page.getByRole('button',{name:'타이머만',exact:true}).click();assert.equal(await card().count(),0);
 console.log('ok bomb shared names, named pass, double click, timer not reset, explosion result, pause/resume and timer-only; game menu renamed');
 const native=['tictactoe','connect4','baskin31','twodice','gameshowquiz','winlosequiz','popcorn','saveorgive','fourclues','treasuredig','mysterybox','lastbox','shufflefind'];
 for(const type of process.env.TURN_FOCUS?[]:native){await sample(type);await card().waitFor();assert.equal(await card().count(),1);assert((await current()).trim());assert.equal(await card().locator('[data-turn-advance]').count(),0);assert.equal(await page.locator('.game-order-strip').count(),0);console.log('ok native',type);}
 await page.goto(fixture+'?start=/games/timer&empty=1');await guide().getByRole('button',{name:'학생·팀 이름으로 만들기',exact:false}).click();
 await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByLabel('참여자 이름',{exact:false}).fill('민지\n지우');await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByRole('button',{name:'게임 시작',exact:false}).click();await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'참가자별 순위',exact:true}).click();await page.getByRole('button',{name:'계속하기',exact:true}).click();await card().waitFor();assert((await current()).trim());assert.equal(await card().locator('[data-turn-advance]').count(),0);await page.getByRole('button',{name:'START',exact:true}).click();await page.getByRole('button',{name:'STOP',exact:true}).click({force:true});await card().locator('[data-turn-advance]').click();await expectCurrent('지우');console.log('ok native timer ranked, stop and next advances exactly once');
 await sample('tictactoe');let before=await current();await page.locator('[data-skin-object="cell"]').first().click();assert.notEqual(await current(),before);assert.equal(await page.locator('[data-skin-object="cell"]').first().isDisabled(),true);await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'계속하기',exact:true}).click();assert.notEqual(await current(),before);
 await sample('popcorn');before=await current();await page.getByRole('button',{name:/한 장|뽑기/}).first().click();assert.notEqual(await current(),before);
 console.log('ok native moves update common turn; no generic skip changes native rules');
 await page.setViewportSize({width:390,height:844});await sample('bomb');await people();await page.getByRole('button',{name:'폭탄 돌리기 시작',exact:true}).click();await page.waitForTimeout(350);await card().locator('[data-turn-advance]').click();await expectCurrent('지우');await page.screenshot({path:resolve(root,'../output/turn-bomb-mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'전체화면',exact:false}).first().click();await page.locator('[data-game-fullscreen="true"]').waitFor();const close=page.getByRole('button',{name:'닫기',exact:true});if(await close.isVisible())await close.click();await expectCurrent('지우');assert.equal(await card().count(),1);await page.screenshot({path:resolve(root,'../output/turn-bomb-fullscreen.png')});console.log('ok mobile/fullscreen single card and turn continuity');

 page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});await sample('bomb');await people();await page.getByRole('button',{name:'폭탄 돌리기 시작',exact:true}).tap();await card().locator('[data-turn-advance]').tap();await expectCurrent('지우');await page.evaluate(()=>document.documentElement.setAttribute('data-font-scale','xlarge'));await page.waitForTimeout(800);assert(await page.locator('img[src="/skins/bomb-word-board.png"]').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'word prompt clipped at large font');await page.screenshot({path:resolve(root,'../output/turn-bomb-large.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(async()=>{const module=await import('/src/i18n/index.ts');await module.default.changeLanguage('en');});await card().getByRole('button',{name:'Pass to 소연',exact:false}).waitFor();console.log('ok touch pass, large font, reduced motion, English');
 assert.deepEqual(errors,[]);console.log('PASS turns, original source/save untouched, no runtime errors');
}catch(error){console.error(error);if(page){await page.screenshot({path:resolve(root,'../output/turn-failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-2500));}process.exitCode=1;}
finally{await browser?.close();await server.close();}
