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
createWordList:async(p)=>{const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,kind:p.kind,items:p.items,updated_at:'now'};lists.push(row);return row;},
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
const auth = `const value={academy:{id:'academy-a',features:{group:true},plan:'paid'},profile:{id:'teacher-a'},isStaff:true,isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:true},pointUnit:'별'};export const useAuth=()=>value;export const AuthProvider=({children})=>children;`;
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
          return "export const supabase={rpc:async()=>({data:[],error:null}),channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}})};";
      },
    },
  ],
  server: { hmr: false, host: "127.0.0.1", port: 5192, strictPort: true },
});
let browser,page;
try {
  await server.listen();
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  page=await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',r=>r.abort());
  const url='http://127.0.0.1:5192/scripts/games/quick.html';
  const draft=()=>page.evaluate(()=>Object.entries(sessionStorage).filter(([k])=>k.startsWith('activity-draft:')).map(([,v])=>JSON.parse(v)).find(d=>d.game_type===location.pathname.split('/').at(-1)));
  await page.goto(url+'?game=matchup&empty=1');
  await page.locator('.game-workspace-stage [data-game="matchup"]').waitFor();
  assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);
  await page.getByRole('button',{name:'게임 시작',exact:true}).click();
  assert.equal(await page.locator('[data-play-mode="play"]').count(),1);
  await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'준비 화면으로',exact:true}).click();
  console.log('ok no classes or vocabulary: sample matchup starts without database writes');
  await page.goto(url+'?game=matchup');
  await page.locator('.game-workspace-stage [data-game="matchup"]').waitFor();
  await page.getByRole('button',{name:'+ 단어장 만들기',exact:true}).click();
  const settings=page.locator('[data-game-existing-settings]');
  for(const [word,meaning] of [['apple','사과'],['cat','고양이']]){await settings.getByRole('button',{name:'+ 짝 추가',exact:true}).click();await settings.getByPlaceholder('단어',{exact:true}).last().fill(word);await settings.getByPlaceholder('뜻',{exact:true}).last().fill(meaning);await settings.getByText('아래 기존 게임 항목 편집기로 내용을 작성하세요.',{exact:false}).click();}
  await page.waitForFunction(()=>Object.entries(sessionStorage).some(([key,value])=>key.startsWith('activity-draft:')&&key.endsWith(':matchup')&&JSON.parse(value).config.classroomSource.cards.length===2));
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.getByRole('button',{name:'다른 게임 하기',exact:true}).click();
  await page.getByRole('button',{name:'돌림판',exact:true}).click();
  await page.waitForURL('**/games/wheel');
  await page.locator('.game-workspace-stage [data-game="wheel"]').waitFor();
  assert.deepEqual((await draft()).items.map(x=>x.label),['apple','cat']);
  assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);
  await page.getByRole('button',{name:'내 자료 불러오기',exact:true}).click();
  await page.getByRole('button',{name:/합성 과일/}).click();
  assert.equal((await draft()).items.length,4);
  await page.getByRole('button',{name:'게임 설정·수정',exact:true}).click();
  await page.locator('[data-preparation-submit] summary').click();
  await page.getByRole('textbox',{name:'활동 이름 (선택)',exact:true}).fill('명시적 저장');
  await page.getByRole('button',{name:'내 활동으로 저장',exact:true}).click();
  await page.waitForFunction(()=>window.__workspace.writes.length===1);
  assert.equal(await page.evaluate(()=>window.__workspace.writes[0].items.length),4);
  await page.getByRole('button',{name:'내 자료 불러오기',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'명시적 저장',exact:true}).click();
  await page.getByRole('button',{name:'활동지 만들기',exact:true}).click();
  await page.waitForURL('**/materials/worksheet');
  assert.equal(await page.evaluate(()=>history.state.usr.materialsWords.length),4);
  console.log('ok input minimum, draft recovery, game switch, vocabulary import, save/reopen and worksheet handoff');
  await page.goBack();
  await page.getByRole('button',{name:'수업에 추가',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__workspace.lessons?.length||0),0);
  await page.getByLabel('추가할 수업 선택',{exact:true}).selectOption('new');
  await page.getByRole('textbox',{name:'수업 이름 (선택)',exact:true}).fill('선택한 새 수업');
  await page.getByRole('dialog').getByRole('button',{name:'수업에 추가',exact:true}).click();
  await page.waitForURL('**/curriculum');
  await page.locator('input[value="선택한 새 수업"]').waitFor();
  await page.waitForFunction(()=>!history.state?.usr?.reopenLessonId);
  assert.equal(await page.evaluate(()=>window.__workspace.lessons[0].playlist.length),1);
  await page.goBack();
  await page.getByRole('button',{name:'수업에 추가',exact:true}).click();
  await page.getByLabel('추가할 수업 선택',{exact:true}).selectOption(await page.evaluate(()=>window.__workspace.lessons[0].id));
  await page.getByRole('dialog').getByRole('button',{name:'수업에 추가',exact:true}).click();
  await page.waitForURL('**/curriculum');
  await page.locator('input[value="선택한 새 수업"]').waitFor();
  await page.waitForFunction(()=>!history.state?.usr?.reopenLessonId);
  assert.equal(await page.evaluate(()=>window.__workspace.lessons[0].playlist.length),2);
  console.log('ok explicit new lesson creation and existing lesson append');
  await page.evaluate(()=>{history.pushState({},'','/dashboard');dispatchEvent(new PopStateEvent('popstate'));});
  await page.getByRole('heading',{name:'오늘은 어떤 게임을 해볼까요?',exact:true}).waitFor();
  await page.getByRole('heading',{name:'합성 과일',exact:true}).waitFor();
  await page.screenshot({path:resolve(root,'../output/game-first-home-desktop.png'),fullPage:true});
  for(const width of [768,390]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`home overflow ${width}`);}
  await page.screenshot({path:resolve(root,'../output/game-first-home-mobile.png'),fullPage:true});
  await page.getByRole('link',{name:'다른 게임 하기',exact:true}).first().click();
  await page.getByRole('link').filter({has:page.getByRole('heading',{name:'매치업',exact:true})}).click();
  await page.waitForURL('**/games/matchup');
  await page.locator('.game-workspace-stage [data-game="matchup"]').waitFor();
  assert.equal((await draft()).config.pairs.length,4);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'game mobile overflow');
  await page.evaluate(()=>{history.pushState({},'','/wordlists');dispatchEvent(new PopStateEvent('popstate'));});
  await page.getByRole('button',{name:/단어장 만들기$/}).click();
  await page.getByPlaceholder('단어장 이름 (예: 9월 3주차 리딩)',{exact:true}).fill('반 없이 만든 원본');
  await page.getByRole('button',{name:'새 단어장 만들기',exact:true}).click();
  await page.getByText('반 없이 만든 원본',{exact:true}).first().waitFor();
  console.log('ok create a reusable word list without registering a class');
  await page.getByRole('button',{name:/문장 모음 만들기$/}).click();
  assert.equal(await page.getByRole('button',{name:'새 단어장 만들기',exact:true}).count(),0);
  await page.getByPlaceholder('문장 목록 이름 (예: 9월 Unit 3 문장)',{exact:true}).fill('반 없는 문장 모음');
  await page.getByRole('button',{name:'새 문장 모음 만들기',exact:true}).click();
  await page.getByText('반 없는 문장 모음',{exact:true}).waitFor();
  await page.getByLabel('영어 문장 (예: I like apples.)',{exact:true}).fill('I enjoy playing games.');
  await page.evaluate(()=>window.__workspace.fail=true);await page.getByRole('button',{name:'문장 추가',exact:true}).click();
  assert.equal(await page.getByLabel('영어 문장 (예: I like apples.)',{exact:true}).inputValue(),'I enjoy playing games.');
  await page.evaluate(()=>window.__workspace.fail=false);await page.getByRole('button',{name:'문장 추가',exact:true}).dblclick();
  await page.waitForFunction(()=>document.querySelector('input[aria-label="영어 문장 (예: I like apples.)"]').value==='');
  assert.equal(await page.getByText('I enjoy playing games.',{exact:true}).count(),1);
  await page.screenshot({path:resolve(root,'../output/game-materials-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1100});
  await page.screenshot({path:resolve(root,'../output/game-materials-desktop.png'),fullPage:true});
  console.log('ok sentence creation names/filter, failed sentence save retains input and successful retry adds once');
  await page.evaluate(()=>{localStorage.setItem('classbank.startCheck.skip','1');history.pushState({},'','/curriculum');dispatchEvent(new PopStateEvent('popstate'));});
  await page.getByRole('button',{name:/수업 시작/}).first().click();
  await page.waitForURL('**/games/wheel');
  await page.locator('.game-workspace-stage [data-game="wheel"]').waitFor();
  assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('classbank.lessonRunner')).lessonName),'선택한 새 수업');
  console.log('ok real curriculum page: classless saved lesson opens and starts its saved game');
  assert.deepEqual(errors,[]);
  console.log('ok desktop/tablet/mobile home and game; source retained through catalogue; no runtime errors');
} catch(error) { console.error((await page.locator('body').innerText()).slice(-5500));throw error; } finally {await browser?.close();await server.close();}
