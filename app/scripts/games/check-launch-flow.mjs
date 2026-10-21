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
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('https://**/*',route=>route.abort());
 const fixture='http://127.0.0.1:5198/scripts/games/focus.html';
 const menu=()=>page.getByRole('button',{name:'☰ 메뉴',exact:true});
 const centralStart=()=>page.locator('[data-game-ready-overlay]').getByRole('button',{name:'게임 시작',exact:true});
 const fullFrame=()=>page.locator('[data-game-fullscreen="true"]');
 await page.goto(fixture+'?start=/games/matchup&empty=1');await centralStart().waitFor();
 assert.equal(await page.locator('[data-game-preparation]').getByRole('button',{name:'게임 시작',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'게임 시작',exact:true}).count(),1);
 const preview=await page.locator('[data-game-preview]').boundingBox(),button=await centralStart().boundingBox();
 assert(Math.abs(preview.x+preview.width/2-button.x-button.width/2)<3,'primary start must be centered over the real preview');
 assert(await page.locator('[data-game-ready-overlay]').getByText(/항목 8개.*준비 완료/).count());
 await page.evaluate(()=>{window.__ticks=0;window.__clock.setTimeout(()=>window.__ticks++,100);});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__ticks),0);
 await page.getByRole('button',{name:'전체화면',exact:true}).click();await fullFrame().waitFor();
 assert.equal(await page.locator('[data-play-mode="prepare"]').count(),1);assert.equal(await page.evaluate(()=>window.__ticks),0);await centralStart().waitFor();
 const native=await page.evaluate(()=>!!document.fullscreenElement);console.log('fullscreen mode:',native?'native browser':'pseudo fallback');
 await centralStart().click();await page.locator('[data-play-mode="play"]').waitFor();assert.equal(await page.locator('[data-game-ready-overlay]').count(),0);
 await page.waitForFunction(()=>window.__ticks===1);
 const board=page.locator('[data-game="matchup"]');await page.evaluate(()=>window.__kept=document.querySelector('[data-game="matchup"]'));
 const firstWord=(await board.locator('.matchup-clay__column').first().getByRole('button').first().innerText()).trim();const meanings={apple:'사과',banana:'바나나',cat:'고양이',dog:'강아지',sun:'해',book:'책',fish:'물고기',milk:'우유'};await board.getByRole('button',{name:firstWord,exact:true}).click();await board.getByRole('button',{name:meanings[firstWord],exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.matchup-clay__tile.is-ok').length===2);
 const exit=page.locator('[data-frame-controls]').getByRole('button',{name:'전체화면 종료',exact:true});await exit.waitFor();
 assert((await exit.boundingBox()).x>1000);await page.screenshot({path:resolve(root,'../output/game-fullscreen-controls.png'),fullPage:true});await exit.click();await page.waitForFunction(()=>!document.querySelector('[data-game-fullscreen="true"]'));
 assert.equal(new URL(page.url()).pathname,'/games/matchup');assert.equal(await page.locator('[data-play-mode="play"]').count(),1);assert.equal(await page.locator('.matchup-clay__tile.is-ok').count(),2);assert(await page.evaluate(()=>window.__kept===document.querySelector('[data-game="matchup"]')));
 await menu().click();const frozen=await page.evaluate(()=>window.__clock.now());await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__clock.now()),frozen);
 await page.getByRole('dialog',{name:'메뉴',exact:true}).getByRole('button',{name:'게임 설정·수정',exact:true}).click();await page.locator('[data-game-existing-settings]').waitFor();await page.getByRole('button',{name:'닫기',exact:true}).click();
 assert.equal(await page.locator('.matchup-clay__tile.is-ok').count(),2);assert(await page.evaluate(()=>window.__kept===document.querySelector('[data-game="matchup"]')));
 await menu().click();await page.getByRole('button',{name:'전체화면',exact:true}).click();await fullFrame().waitFor();
 await menu().click();const held=await page.evaluate(()=>window.__clock.now());
 await page.getByRole('dialog',{name:'메뉴',exact:true}).getByRole('button',{name:'전체화면 종료',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-game-fullscreen="true"]'));
 await page.waitForTimeout(140);assert.equal(await page.evaluate(()=>window.__clock.now()),held);assert.equal(await page.locator('dialog[open]').count(),1);
 await page.getByRole('button',{name:'계속하기',exact:true}).click();await menu().click();await page.getByRole('button',{name:'전체화면',exact:true}).click();await fullFrame().waitFor();
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[data-game-fullscreen="true"]'),null,{timeout:3000});
 assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.locator('.matchup-clay__tile.is-ok').count(),2);
 await menu().click();await page.getByRole('button',{name:'준비 화면으로',exact:true}).click();await centralStart().waitFor();assert.equal(await page.locator('.matchup-clay__tile.is-ok').count(),2);
 await page.screenshot({path:resolve(root,'../output/game-central-start-desktop.png'),fullPage:true});
 console.log('ok centered start/real readiness; fullscreen alone stays paused; persistent fullscreen exit and Escape retain board/score/run state; menu opens existing settings directly');
 // Denied fullscreen must provide the same independent size change and exit.
 await page.evaluate(()=>Element.prototype.requestFullscreen=()=>Promise.reject(new Error('synthetic denied')));
 await page.getByRole('button',{name:'전체화면',exact:true}).click();await fullFrame().waitFor();assert.equal(await page.locator('[data-play-mode="prepare"]').count(),1);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[data-game-fullscreen="true"]'));
 await page.getByRole('button',{name:'샘플로 바로 해보기',exact:true}).click();await page.locator('[data-play-mode="play"]').waitFor();assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);assert.equal(await page.evaluate(()=>window.__workspace.wordWrites?.length||0),0);
 await menu().click();await page.getByRole('link',{name:'게임메뉴',exact:true}).click();await page.waitForURL('**/games');
 console.log('ok interactive sample starts with no persistent writes; menu game picker opens the full catalogue; denied fullscreen also preserves preparation state');
 await page.goto(fixture+'?start=/games/icecream');await centralStart().waitFor();assert.equal(await page.getByRole('button',{name:'+ 단어장 만들기',exact:true}).count(),0);
 await page.getByRole('button',{name:'▶ 게임 방법 영상',exact:true}).click();const video=page.locator('dialog video');await video.waitFor();
 await page.waitForFunction(()=>Number.isFinite(document.querySelector('dialog video')?.duration));const seconds=await video.evaluate(el=>Math.round(el.duration));await page.getByText(`게임 방법 영상 · ${seconds}초`,{exact:true}).waitFor();
 assert.equal(await page.locator('[data-play-mode="prepare"]').count(),1);await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'게임 설정·수정',exact:true}).click();await page.locator('[data-preparation-submit] summary').click();
 assert.equal(await page.getByLabel('활동 이름 (선택)',{exact:true}).inputValue(),'');await page.getByRole('button',{name:'내 활동으로 저장',exact:true}).click();await page.waitForFunction(()=>window.__workspace.writes.length===1);
 assert.equal(await page.evaluate(()=>window.__workspace.writes[0].name),'아이스크림 가게');
 await page.getByRole('button',{name:'게임 설정·수정',exact:true}).click();page.once('dialog',dialog=>dialog.accept('우리 반 아이스크림'));
 await page.locator('[data-activity-title]').getByRole('button',{name:'이름 변경',exact:true}).click();await page.locator('[data-activity-title]').getByText('우리 반 아이스크림',{exact:true}).waitFor();await page.getByRole('button',{name:'닫기',exact:true}).click();
 await centralStart().click();await page.getByRole('button',{name:/1\. 메뉴판 보기/}).waitFor();
 await menu().click();await page.getByRole('button',{name:'준비 화면으로',exact:true}).click();
 await page.getByRole('button',{name:'게임 설정·수정',exact:true}).click();await page.getByRole('button',{name:'+ 새 아이스크림 가게',exact:false}).click();
 await page.locator('[data-game-existing-settings]').getByRole('button',{name:'만들기',exact:true}).click();await page.waitForFunction(()=>window.__workspace.writes.length===2);
 assert.equal(await page.evaluate(()=>window.__workspace.writes[1].name),'아이스크림 가게');
 await page.getByRole('button',{name:'+ 새 아이스크림 가게',exact:false}).click();await page.locator('[data-game-existing-settings]').getByRole('button',{name:'만들기',exact:true}).click();await page.waitForFunction(()=>window.__workspace.writes.length===3);
 assert.equal(await page.evaluate(()=>window.__workspace.writes[2].name),'아이스크림 가게 2');
 console.log('ok real video duration, independent interactive sample, optional native game name, rename, sequential default and unambiguous menu-board stage');
 await page.goto(fixture+'?start=/wordlists');await page.getByRole('button',{name:'+ 단어장 만들기',exact:false}).click();
 await page.getByRole('button',{name:'새 단어장 만들기',exact:true}).click();await page.getByText('새 단어장',{exact:true}).first().waitFor();
 await page.getByRole('button',{name:'+ 단어장 만들기',exact:false}).click();await page.getByLabel('이름 (선택)',{exact:true}).fill('   ');await page.getByRole('button',{name:'새 단어장 만들기',exact:true}).click();await page.getByText('새 단어장 2',{exact:true}).waitFor();
 await page.getByRole('button',{name:'+ 문장 모음 만들기',exact:false}).click();await page.getByRole('button',{name:'새 문장 모음 만들기',exact:true}).click();await page.getByText('새 문장 모음',{exact:true}).first().waitFor();
 console.log('ok word/sentence material creation with blank/whitespace names and numbered defaults, without registering a class');
 await page.goto(fixture+'?start=/games');await page.getByRole('button',{name:/^문장 \d+$/}).click();
 const cards=await page.locator('a').filter({has:page.locator('h3')}).allTextContents();const catchIndex=cards.findIndex(t=>t.includes('문장 잡기'));assert(catchIndex>=0);assert(cards[catchIndex+1].includes('번개 피하기'));
 const count=Number((await page.getByRole('button',{name:/^문장 \d+$/}).innerText()).match(/\d+/)[0]);assert.equal(cards.length,count);
 await page.getByRole('searchbox').fill('번개');assert.equal(await page.locator('a').filter({has:page.locator('h3')}).count(),1);
 await page.goto(fixture+'?start=/games/catchsentence');await page.setViewportSize({width:390,height:844});await centralStart().waitFor();await page.getByRole('button',{name:'전체화면',exact:true}).click();await fullFrame().waitFor();
 await page.locator('[data-frame-controls]').getByRole('button',{name:'전체화면 종료',exact:true}).waitFor();assert.equal(await page.locator('[data-play-mode="prepare"]').count(),1);
 await page.screenshot({path:resolve(root,'../output/game-fullscreen-ready-mobile.png'),fullPage:true});await centralStart().click();await page.setViewportSize({width:1920,height:1080});await page.setViewportSize({width:390,height:844});await page.locator('[data-frame-controls]').getByRole('button',{name:'전체화면 종료',exact:true}).click();
 assert.equal(await page.locator('[data-play-mode="play"]').count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:resolve(root,'../output/game-menu-mobile.png'),fullPage:true});
 console.log('ok sentence category/count/search/order; mobile fullscreen exit and interactive resize keep current game');
 for(const type of ['feedmonster','sentencebridge','sentencetower']){
  await page.goto(fixture+'?start=/games/'+type);await centralStart().waitFor();assert.equal(await page.getByRole('button',{name:'게임 시작',exact:true}).count(),1);
  await centralStart().click();const story=page.locator('[data-story-game="'+type+'"]');await story.locator('[data-choice]').first().waitFor();
  assert.equal(await story.getByRole('button',{name:'전체 화면',exact:true}).count(),0);await page.evaluate(()=>window.__story=document.querySelector('[data-story-game]'));
  await story.locator('[data-choice]').first().click();if(type==='feedmonster')await story.getByRole('button',{name:'몬스터에게 먹이 주기',exact:true}).click();
  await menu().click();await page.getByRole('button',{name:'게임 설정·수정',exact:true}).click();await page.getByRole('button',{name:'닫기',exact:true}).click();
  assert(await page.evaluate(()=>window.__story===document.querySelector('[data-story-game]')));await menu().click();await page.getByRole('button',{name:'준비 화면으로',exact:true}).click();
  assert(await page.evaluate(()=>window.__story===document.querySelector('[data-story-game]')));
 }
 console.log('ok three existing story games: one shared start, common fullscreen/menu controls, native answer and mounted progress preserved through settings/preparation');
 await page.goto(fixture+'?start=/games/wheel&student=1');await page.getByRole('button',{name:'돌리기',exact:true}).last().waitFor();
 assert.equal(await page.locator('[data-game-preparation]').count(),0);assert.equal(await page.locator('[data-game-ready-overlay]').count(),0);assert.equal(await page.getByRole('button',{name:'+ 단어장 만들기',exact:true}).count(),0);
 await page.getByRole('button',{name:'돌리기',exact:true}).last().click();assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);
 console.log('ok existing read-only student game remains playable without teacher preparation or creation controls');
 assert.deepEqual(errors,[]);
}catch(error){console.error(error);if(page){console.error((await page.locator('body').innerText()).slice(-7000));await page.screenshot({path:resolve(root,'../output/game-launch-failure.png'),fullPage:true});}process.exitCode=1;}
finally{await browser?.close();await server.close();}
