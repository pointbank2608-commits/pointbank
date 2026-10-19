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
const functions={
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
const auth = `const value={academy:{id:'academy-a',features:{group:true},plan:'paid',deletion_requested_at:null,deletion_scheduled_at:null},profile:{id:'teacher-a'},isStaff:true,isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:false,inTrial:false,daysLeft:7},pointUnit:'별'};export const useAuth=()=>value;export const AuthProvider=({children})=>children;`;
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
  server: { hmr: false, host: "127.0.0.1", port: 5194, strictPort: true },
});
let browser,page;
try {
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(new Error('synthetic denied'));});
 page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 const fixture='http://127.0.0.1:5194/scripts/games/focus.html';
 await page.goto(fixture);await page.getByRole('heading',{name:'오늘은 어떤 게임을 해볼까요?',exact:true}).waitFor();
 assert((await page.getByRole('heading',{name:'오늘 가르칠 내용이 준비되어 있나요?',exact:true}).boundingBox()).y < (await page.getByRole('heading',{name:'추천 게임',exact:true}).boundingBox()).y);
 await page.getByRole('link',{name:'게임 고르기 →',exact:true}).click();await page.waitForURL('**/games');
 await page.getByRole('link').filter({has:page.getByRole('heading',{name:'매치업',exact:true})}).click();await page.waitForURL('**/games/matchup');
 await page.getByRole('button',{name:'+ 단어장 만들기',exact:true}).click();
 assert.equal(await page.locator('textarea').filter({visible:true}).count(),0);
 const settings=page.locator('[data-game-existing-settings]');
 for(const [word,meaning] of [['apple','사과'],['cat','고양이']]){
  await settings.getByRole('button',{name:'+ 짝 추가',exact:true}).click();
  await settings.getByPlaceholder('단어',{exact:true}).last().fill(word);await settings.getByPlaceholder('뜻',{exact:true}).last().fill(meaning);
  await settings.getByText('아래 기존 게임 항목 편집기로 내용을 작성하세요.',{exact:false}).click();
 }
 await page.waitForFunction(()=>Object.entries(sessionStorage).some(([k,v])=>k.startsWith('activity-draft:')&&k.endsWith(':matchup')&&JSON.parse(v).config.classroomSource.cards.length===2));
 assert.equal(await page.getByRole('checkbox',{name:'내 단어장에도 저장',exact:true}).isChecked(),false);
 assert.equal(await page.getByLabel('자료 이름',{exact:true}).count(),0);
 await page.getByRole('button',{name:'이 내용으로 게임 시작',exact:true}).click();
 await page.locator('[data-play-mode="play"]').waitFor();
 assert.equal(await page.locator('[data-app-chrome]').first().isVisible(),false);
 assert(await page.evaluate(()=>[...document.querySelectorAll('[data-app-chrome]')].every(x=>x.inert)));
 assert.equal(await page.locator('[data-game="matchup"] .game-play-toolbar').count(),0);
 assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);assert.equal(await page.evaluate(()=>window.__workspace.wordWrites?.length||0),0);
 const board=page.locator('.game-workspace-stage [data-game="matchup"]');
 await board.getByRole('button',{name:'apple',exact:true}).click();await board.getByRole('button',{name:'사과',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.matchup-clay__tile.is-ok').length===2);
 await page.evaluate(()=>window.__kept=document.querySelector('[data-game="matchup"]'));
 await page.getByRole('button',{name:'선생님 메뉴',exact:true}).click();
 const paused=await page.evaluate(()=>window.__clock.now());await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.__clock.now()),paused);
 await page.getByRole('button',{name:'게임으로 돌아가기',exact:true}).click();
 assert.equal(await page.locator('.matchup-clay__tile.is-ok').count(),2);
 await page.getByRole('button',{name:'선생님 메뉴',exact:true}).click();
 await page.getByRole('button',{name:'준비 화면으로 돌아가기',exact:true}).click();
 assert(await page.evaluate(()=>window.__kept===document.querySelector('[data-game="matchup"]')));
 assert.equal(await page.locator('.matchup-clay__tile.is-ok').count(),2);
 await page.getByRole('button',{name:'게임 시작',exact:true}).click();
 await page.getByRole('button',{name:'선생님 메뉴',exact:true}).click();await page.getByRole('button',{name:'되돌리기',exact:true}).click();
 await page.getByRole('button',{name:'게임으로 돌아가기',exact:true}).click();assert.equal(await page.locator('.matchup-clay__tile.is-ok').count(),0);
 console.log('ok existing native pair editor; no duplicate input; unsaved play; chrome hidden; match controls, pause/resume, prepare return and undo preserve mounted board');
 await page.getByRole('button',{name:'선생님 메뉴',exact:true}).click();await page.getByRole('button',{name:'전체화면',exact:true}).click();
 await page.getByRole('button',{name:'게임으로 돌아가기',exact:true}).click();
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert(await page.evaluate(()=>window.__kept===document.querySelector('[data-game="matchup"]')));
 await page.screenshot({path:resolve(root,'../output/game-focus-mobile.png'),fullPage:true});
 await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'선생님 준비',exact:true}).waitFor();
 await page.getByRole('button',{name:'준비 화면으로 돌아가기',exact:true}).click();
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'항목·정답·게임 설정',exact:true}).click();
 await page.getByRole('checkbox',{name:'내 단어장에도 저장',exact:true}).check();await page.getByLabel('자료 이름',{exact:true}).fill('명시적으로 저장한 단어');
 await page.evaluate(()=>window.__workspace.fail=true);await page.getByRole('button',{name:'이 내용으로 게임 시작',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'입력 내용은 유지됩니다'}).waitFor();assert.equal(await settings.getByPlaceholder('단어',{exact:true}).first().inputValue(),'apple');
 await page.evaluate(()=>window.__workspace.fail=false);await page.getByRole('button',{name:'이 내용으로 게임 시작',exact:true}).dblclick();
 await page.locator('[data-play-mode="play"]').waitFor();assert.equal(await page.evaluate(()=>window.__workspace.wordWrites.length),1);
 await page.getByRole('button',{name:'선생님 메뉴',exact:true}).click();await page.getByRole('button',{name:'다른 게임 하기',exact:true}).click();await page.getByRole('button',{name:'돌림판',exact:true}).click();
 await page.waitForURL('**/games/wheel');await page.getByRole('button',{name:'참여자·팀·순서',exact:true}).click();
 await page.getByLabel('임시 참여자 (한 줄에 한 명)',{exact:true}).fill('지우\n소연\n민수');
 await page.getByRole('checkbox',{name:'개인·팀 순서로 진행 (해제하면 자유 참여)',exact:true}).check();
 await page.getByRole('button',{name:'여기서 시작',exact:true}).nth(1).click();await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'게임 시작',exact:true}).click();
 await page.getByRole('button',{name:'지금: 소연 · 다음: 민수',exact:true}).waitFor();
 await page.getByRole('button',{name:'다음 참여자',exact:true}).click();await page.getByRole('button',{name:'지금: 민수 · 다음: 지우',exact:true}).waitFor();
 await page.waitForTimeout(270);await page.getByRole('button',{name:'다음 참여자',exact:true}).dblclick();await page.getByRole('button',{name:'지금: 지우 · 다음: 소연',exact:true}).waitFor();
 await page.getByRole('button',{name:'지금: 지우 · 다음: 소연',exact:true}).click();await page.getByLabel('지우',{exact:true}).check();await page.getByLabel('민수',{exact:true}).check();await page.getByRole('button',{name:'닫기',exact:true}).click();
 await page.getByRole('button',{name:'지금: 소연 · 다음: 소연',exact:true}).waitFor();await page.getByRole('button',{name:'다음 참여자',exact:true}).click();await page.getByRole('button',{name:'지금: 소연 · 다음: 소연',exact:true}).waitFor();
 await page.screenshot({path:resolve(root,'../output/game-focus-desktop.png'),fullPage:true});
 console.log('ok optional resource save, failed-save recovery, duplicate-click protection, source reuse, fullscreen denial, mobile, manual current/next, wraparound, exclusion and one-person boundary');

 await page.goto(fixture+'?start=/games/tictactoe');await page.getByRole('button',{name:'게임 시작',exact:true}).click();
 assert.equal(await page.locator('[data-current-next]').count(),0);assert.equal(await page.locator('.game-workspace-stage input').count(),0);
 await page.locator('[data-skin-object="cell"]').first().click();assert.equal(await page.locator('[data-skin-object="cell"]').first().isDisabled(),true);
 const turnText=await page.getByText(/차례예요/).innerText();await page.getByRole('button',{name:'선생님 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임으로 돌아가기',exact:true}).click();
 assert.equal(await page.getByText(/차례예요/).innerText(),turnText);assert.equal(await page.locator('[data-skin-object="cell"]').first().isDisabled(),true);
 console.log('ok native team game: actual move/turn preserved; no duplicate manual participant controls');
 await page.goto(fixture+'?start=/games/timer');assert.equal(await page.getByRole('button',{name:'+ 단어장 만들기',exact:true}).count(),0);await page.getByRole('button',{name:'게임 시작',exact:true}).click();
 await page.getByRole('button',{name:'START',exact:true}).click();await page.waitForTimeout(200);await page.getByRole('button',{name:'선생님 메뉴',exact:true}).click();
 const time=await page.evaluate(()=>window.__clock.now());await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.__clock.now()),time);await page.getByRole('button',{name:'게임으로 돌아가기',exact:true}).click();
 await page.getByRole('button',{name:'STOP',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'다시 도전',exact:true}).waitFor();
 console.log('ok timer actual start/stop/result and teacher-menu pause without mandatory material or duplicate turn controls');
 await page.goto(fixture+'?start=/games/quizshow');await page.getByRole('button',{name:'게임 시작',exact:true}).click();await page.getByRole('button',{name:/미리보기 시작/}).click();
 await page.getByRole('button',{name:'선생님 메뉴',exact:true}).click();await page.getByText('온라인 참여자의 세션은 계속됩니다.',{exact:false}).waitFor();await page.getByRole('button',{name:'게임으로 돌아가기',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);console.log('ok online-game local preview: no saved resource/session creation; host-menu constraint shown');
 await page.goto(fixture+'?start=/games/unscramble');await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{const cards=Array.from({length:24},(_,index)=>({id:'long-'+index,word:'I would like to practise these very long sentences together with my classmates every morning before we start our English lesson.',meaning:'긴 문장 '+index,imageUrl:null}));history.pushState({usr:{quickSource:{ownerId:'teacher-a',academyId:'academy-a',cards,kind:'sentence',name:'긴 문장 24개'}},key:'long-24'},'','/games/unscramble');dispatchEvent(new PopStateEvent('popstate'));});
 await page.getByText('긴 문장 24개',{exact:true}).first().waitFor();await page.getByRole('button',{name:'게임 시작',exact:true}).click();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.evaluate(()=>JSON.parse(Object.entries(sessionStorage).find(([k])=>k.startsWith('activity-draft:')&&k.endsWith(':unscramble'))[1]).items.length),24);
 await page.screenshot({path:resolve(root,'../output/game-focus-long-sentences.png'),fullPage:true});
 await page.evaluate(()=>{for(const el of document.querySelectorAll('.game-workspace-stage *'))if(el.scrollHeight>el.clientHeight+20&&getComputedStyle(el).overflowY==='auto'){el.scrollTop=el.scrollHeight;window.__internalScroll=el.scrollTop;}});
 assert((await page.evaluate(()=>window.__internalScroll||0))>0,'long boards must remain internally scrollable');
 console.log('ok long sentences and 24-item source on mobile without dropping items or page-width overflow; internal scrolling retains all controls');
 await page.goto(fixture+'?start=/games/wheel');await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'+ 문장 모음 만들기',exact:true}).click();
 const sentenceInput=page.getByPlaceholder('단어·문장 (예: apple 또는 I like apples.)',{exact:true});
 await sentenceInput.fill('I enjoy playing games.');
 await page.goto(fixture+'?start=/games/wheel');await page.getByRole('button',{name:'항목·정답·게임 설정',exact:true}).click();
 assert.equal(await sentenceInput.inputValue(),'I enjoy playing games.','unsubmitted native editor field must survive navigation');
 await page.getByRole('button',{name:'추가',exact:true}).click();
 await page.getByRole('button',{name:'닫기',exact:true}).first().click();
 await page.getByRole('button',{name:'+ 단어장 만들기',exact:true}).click();
 await page.getByRole('button',{name:'닫기',exact:true}).first().click();
 await page.getByRole('button',{name:'+ 문장 모음 만들기',exact:true}).click();
 await page.getByRole('checkbox',{name:'내 문장 모음에도 저장',exact:true}).waitFor();
 await page.waitForFunction(()=>Object.entries(sessionStorage).some(([k,v])=>k.startsWith('activity-draft:')&&k.endsWith(':wheel')&&JSON.parse(v).config.classroomSource.kind==='sentence'&&JSON.parse(v).items.some(i=>i.label==='I enjoy playing games.')));
 console.log('ok native unsent text recovery and word/sentence composition switch without loss');
 await page.getByRole('button',{name:'닫기',exact:true}).first().click();
 const returnLink=page.locator('[data-game-preparation]').getByRole('link',{name:'← 게임 목록',exact:true});
 await returnLink.focus();await page.keyboard.press('Enter');await page.waitForURL('**/games');
 await page.getByRole('link').filter({has:page.getByRole('heading',{name:'돌림판',exact:true})}).click();await page.waitForURL('**/games/wheel');
 await page.waitForFunction(()=>document.querySelector('[data-game-preparation]')?.textContent.includes('새 문장 모음'));
 await page.getByRole('button',{name:'게임 시작',exact:true}).waitFor({state:'visible'});
 assert.equal(await page.getByRole('button',{name:'게임 시작',exact:true}).isEnabled(),true);
 await page.setViewportSize({width:390,height:844});await returnLink.waitFor({state:'visible'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:resolve(root,'../output/game-preparation-back-mobile.png'),fullPage:true});
 console.log('ok preparation game-list link: keyboard navigation, content recovery after return and mobile visibility');
 assert.deepEqual(errors,[]);
} catch(error){console.error('FAILED',error);if(page){console.error((await page.locator('body').innerText()).slice(-6500));await page.screenshot({path:resolve(root,'../output/game-focus-failure.png'),fullPage:true});}process.exitCode=1;}
finally{await browser?.close();await server.close();}
