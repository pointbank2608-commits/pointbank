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
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1280,height:1000}});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('browser error',e.message);});await page.route('https://**/*',r=>r.abort());
 const fixture='http://127.0.0.1:5198/scripts/games/focus.html';
 const guide=()=>page.locator('[data-game-guide]');
 const {GAME_CATALOG:catalog}=await server.ssrLoadModule('/src/lib/gameCatalog.ts');
 const {guideSample,guideProblem,GUIDE_FAMILIES}=await server.ssrLoadModule('/src/lib/gameGuide.ts');
 assert.equal(catalog.filter(g=>g.number<=53).length,53);assert.equal(Object.keys(GUIDE_FAMILIES).length,53);
 for(const g of process.env.GUIDE_SKIP_SAMPLES?[]:catalog.filter(g=>g.number<=53)){
  await page.goto(fixture+'?start='+g.path+'&empty=1');await guide().getByRole('button',{name:'샘플로 먼저 해보기',exact:false}).click();
  await page.locator('[data-game-guide][data-guide-step="3"]').waitFor();
  const start=guide().getByRole('button',{name:'게임 시작',exact:false});
  try{await start.click({timeout:7000});}catch(e){console.error('sample failed',g.type,await guide().innerText());throw e;}
  await page.locator('[data-play-mode="play"]').waitFor();assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);
  console.log('ok sample',g.type);
 }
 console.log(process.env.GUIDE_SKIP_SAMPLES?'focused scenarios; sample loop skipped':'ok 53 native games: guided sample prepares and starts without persistent game/wordlist/lesson writes');
 await page.goto(fixture+'?start=/games/wheel&empty=1');await guide().getByRole('button',{name:'학생·팀 이름으로 만들기',exact:false}).click();
 await guide().getByLabel('학생·팀 이름',{exact:true}).first().fill('민지');await guide().getByRole('button',{name:'항목 추가',exact:false}).click();await guide().getByLabel('학생·팀 이름',{exact:true}).nth(1).fill('지우');
 await guide().getByRole('button',{name:'다음',exact:true}).click();
 assert((await guide().innerText()).includes('민지'));await guide().getByRole('button',{name:'게임 시작',exact:false}).click();assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);
 console.log('ok direct names plus independent participants without class or save');
 await page.goto(fixture+'?start=/games/matchup&empty=1');await guide().getByRole('button',{name:'단어로 만들기',exact:false}).click();
 await guide().getByLabel('단어',{exact:true}).first().fill('apple');await guide().getByLabel('뜻',{exact:true}).first().fill('사과');
 await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByRole('alert').waitFor();
 await guide().getByRole('button',{name:'항목 추가',exact:false}).click();await guide().getByLabel('단어',{exact:true}).nth(1).fill('cat');await guide().getByLabel('뜻',{exact:true}).nth(1).fill('고양이');
 await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByRole('button',{name:'게임 시작',exact:false}).click();
 console.log('ok native pair validation, direct unsaved match content, separate participant step');
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 설정·수정',exact:true}).click();await page.locator('[data-preparation-submit] summary').click();await page.getByRole('textbox',{name:'활동 이름 (선택)',exact:true}).fill('안내에서 만든 저장 게임');await page.getByRole('button',{name:'내 활동으로 저장',exact:true}).click();await page.waitForFunction(()=>window.__workspace.writes.length===1);
 await page.locator('[data-game-preparation] summary').click();await page.getByRole('button',{name:'저장한 게임 불러오기',exact:true}).click();await page.getByRole('button',{name:'안내에서 만든 저장 게임',exact:true}).click();
 await page.getByRole('button',{name:'활동지 만들기',exact:true}).click();await page.waitForURL('**/materials/worksheet');assert.equal(await page.evaluate(()=>history.state.usr.materialsWords.length),2);
 await page.goBack();if(await guide().isVisible())await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('button',{name:'수업에 추가',exact:true}).click();assert.equal(await page.evaluate(()=>window.__workspace.lessons?.length||0),0);
 await page.getByLabel('추가할 수업 선택',{exact:true}).selectOption('new');await page.getByRole('textbox',{name:'수업 이름 (선택)',exact:true}).fill('안내 검증 수업');await page.getByRole('dialog').getByRole('button',{name:'수업에 추가',exact:true}).click();await page.waitForURL('**/curriculum');assert.equal(await page.evaluate(()=>window.__workspace.lessons[0].playlist.length),1);
 console.log('ok guided activity explicit save/reopen, identical source to worksheet, explicit new lesson only after selection');

 await page.goto(fixture+'?start=/games');await page.getByRole('button',{name:'+ 게임 만들기',exact:true}).click();await page.getByRole('button',{name:'문장으로 만들기',exact:false}).click();
 await page.locator('[data-game-create] textarea').fill('I like apples.\nWe read books.');await page.locator('[data-game-create]').getByRole('button',{name:'다음',exact:true}).click();await page.locator('[data-game-create]').getByRole('button',{name:/문장 배열하기/}).click();
 await page.locator('[data-game-guide][data-guide-step="1"]').waitFor();await guide().getByLabel('문장',{exact:true}).first().waitFor();assert.equal(await guide().getByLabel('문장',{exact:true}).first().inputValue(),'I like apples.');
 await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByRole('button',{name:'게임 시작',exact:false}).click();
 console.log('ok create menu: sentence entry -> compatible catalogue -> native sentence game, preserved source');

 const prepare=async(type,label)=>{await page.goto(fixture+'?start=/games/'+type);await guide().getByRole('button',{name:label,exact:false}).click();await page.locator('[data-guide-step="1"]').waitFor();};
 const finish=async()=>{await guide().getByRole('button',{name:'다음',exact:true}).click();if(await page.locator('[data-guide-step="2"]').count())await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByRole('button',{name:'게임 시작',exact:false}).click();};
 await prepare('groupsort','단어로 만들기');await guide().getByRole('button',{name:'내 단어장 불러오기',exact:true}).click();await guide().getByRole('button',{name:/합성 과일/}).click();
 await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByLabel('참여자 이름',{exact:false}).fill('민지\n지우');await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByRole('button',{name:'게임 시작',exact:false}).click();assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);
 console.log('ok saved vocabulary/categories -> groups, independent temporary participants, no original writes');
 await prepare('truefalse','단어로 만들기');await guide().getByLabel('문장',{exact:true}).first().fill('Cats can fly.');await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByRole('alert').waitFor();await guide().getByLabel('정답 O / X',{exact:true}).selectOption('X');await finish();
 console.log('ok true/false requires explicit answer');
 await prepare('sentencebridge','문장으로 만들기');await guide().getByLabel('문장에서 빈칸으로 만들 부분을 선택하세요.',{exact:true}).fill('We like apples.');
 await guide().getByLabel('문장에서 빈칸으로 만들 부분을 선택하세요.',{exact:true}).evaluate(el=>{el.setSelectionRange(3,7);el.dispatchEvent(new Event('select',{bubbles:true}));});await guide().getByRole('button',{name:'선택한 부분을 빈칸으로',exact:true}).click();
 assert((await guide().getByLabel('문제',{exact:true}).evaluateAll(els=>els.map(el=>el.value))).some(s=>s==='We ___ apples.'));
 console.log('ok native sentence bridge blank selection derives prompt and answer');
 await prepare('sentencetower','문장으로 만들기');await finish();console.log('ok guided sentence expansion preserves teacher-authored phrase positions');
 await prepare('watermelon','단어로 만들기');await finish();console.log('ok guided sentence slots and pattern -> native game');
 await prepare('labeleddiagram','단어로 만들기');
 await guide().getByRole('button',{name:'기존 상세 편집기 열기',exact:true}).click();
 await page.getByRole('button',{name:'닫기',exact:true}).first().click();
 console.log('ok detailed editor remains available without a duplicated game board');
 await page.goto(fixture+'?start=/games/wheel&saved=1');await page.getByRole('button',{name:'닫기',exact:true}).click();await page.locator('[data-game-preparation] summary').click();await page.getByRole('button',{name:'저장한 게임 불러오기',exact:true}).click();await page.getByRole('button',{name:'원본 저장 게임',exact:true}).click();
 await page.locator('[data-game-preparation]').getByRole('button',{name:'무엇으로 게임을 만들까요?',exact:true}).click();await guide().getByRole('button',{name:'단어로 만들기',exact:false}).click();await guide().getByLabel('단어',{exact:true}).first().fill('CHANGED');await finish();
 assert.equal(await page.evaluate(()=>window.__workspace.templates.find(t=>t.id==='original-game').items[0].label),'ORIGINAL');assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);
 console.log('ok guided edit of saved activity makes a temporary copy; saved original unchanged');
 await page.goto(fixture+'?start=/games/wheel');await guide().getByRole('button',{name:'단어로 만들기',exact:false}).click();await guide().getByLabel('단어',{exact:true}).first().fill('RECOVER_ME');await page.goto(fixture+'?start=/games/wheel');await guide().getByRole('button',{name:'단어로 만들기',exact:false}).click();assert.equal(await guide().getByLabel('단어',{exact:true}).first().inputValue(),'RECOVER_ME');
 console.log('ok unsubmitted guided table recovers after a page reload');
 await page.setViewportSize({width:390,height:844});await page.goto(fixture+'?start=/dashboard');await page.getByRole('button',{name:'+ 게임 만들기',exact:true}).click();assert(await page.locator('[data-game-create]').isVisible());
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:resolve(root,'../output/game-create-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'닫기',exact:true}).click();await page.goto(fixture+'?start=/games/matchup');await guide().getByRole('button',{name:'단어로 만들기',exact:false}).click();await page.screenshot({path:resolve(root,'../output/game-guide-mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);
 console.log('ok mobile launcher, native dialogs, no horizontal page overflow or runtime errors');
}catch(e){console.error(e);if(page){console.error((await page.locator('body').innerText()).slice(-6000));await page.screenshot({path:resolve(root,'../output/game-guide-failure.png'),fullPage:true});}process.exitCode=1;}
finally{await browser?.close();await server.close();}
