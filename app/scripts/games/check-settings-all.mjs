import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
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
updateGameTemplate:async(id,p)=>{if(window.__workspace.fail)throw new Error('synthetic update failure');(window.__workspace.updates||=[]).push({id,patch:structuredClone(p)});if(isActivityDraft(id))patchActivityDraft(id,p);else Object.assign(window.__workspace.templates.find(t=>t.id===id)||{},p)}
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
  server: { hmr: false, host: "127.0.0.1", port: 5327, strictPort: true },
});


let browser,page;const results=[];
try {
 await server.listen();const {GAME_CATALOG:catalog}=await server.ssrLoadModule('/src/lib/gameCatalog.ts');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 mkdirSync(resolve(root,'../output/game-settings-audit'),{recursive:true});
 for(const game of catalog.filter(g=>g.type!=='quizshow'&&(!process.env.SETTINGS_AUDIT_ONLY||process.env.SETTINGS_AUDIT_ONLY.split(',').includes(g.type)))){
  const row={game:game.type,number:game.number};try{
   await page.setViewportSize({width:1440,height:1000});
   await page.goto('http://127.0.0.1:5327/scripts/games/focus.html?start='+game.path);
   const guide=page.locator('[data-game-guide]');await guide.getByRole('button',{name:'샘플로 먼저 해보기',exact:false}).click();await page.locator('[data-game-guide][data-guide-step="3"]').waitFor();
   await page.getByRole('button',{name:'닫기',exact:true}).click();await page.locator('[data-game-preparation] summary').first().click();await page.getByRole('button',{name:'게임 설정·수정',exact:true}).first().click();
   const footer=page.locator('[data-preparation-submit]'),save=footer.getByRole('button',{name:'게임 저장하고 닫기',exact:true});await save.waitFor();
   const editor=page.locator('[data-game-existing-settings]');
   const adventure=game.number>=54;
   const story=['feedmonster','sentencebridge','sentencetower'].includes(game.type);
   if(adventure||story||game.type==='sentencesplash'){
    if(adventure){const count=editor.getByLabel('최대 문제 개수',{exact:true});row.expectedCount=Number(await count.inputValue())===1?2:1;await count.fill(String(row.expectedCount));}
    else if(story)await editor.getByRole('checkbox',{name:'효과음',exact:true}).setChecked(!await editor.getByRole('checkbox',{name:'효과음',exact:true}).isChecked());
    else await editor.getByRole('combobox',{name:'문장당 제한 시간',exact:true}).selectOption('30');
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-preparation-submit] button')].find(b=>b.textContent.trim()==='게임 저장하고 닫기')?.disabled===true);
    await footer.getByText('아직 게임에 적용하지 않은 수정 내용이 있어요.',{exact:false}).waitFor();
    await editor.getByRole('button',{name:adventure?'설정 적용 · 게임 다시 준비':story?'설정 적용 · 미리보기':'미리보기 적용',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-preparation-submit] button')].find(b=>b.textContent.trim()==='게임 저장하고 닫기')?.disabled===false);
    row.pendingGuard=true;
   }
   if(await save.isDisabled())throw new Error('Save disabled: '+(await footer.innerText()));

   let b=await footer.boundingBox();assert(b.y>=0&&b.y+b.height<=1001);
   await save.click();await page.getByRole('dialog').waitFor({state:'hidden'});
   const saved=await page.evaluate(()=>window.__workspace.writes[0]);assert(saved);assert.equal(saved.game_type,game.type);if(adventure)assert.equal(saved.config.adventure.count,row.expectedCount);if(game.type==='sentencesplash')assert.equal(saved.config.splashSeconds,30);row.saved=true;
   await page.getByRole('button',{name:'게임 설정·수정',exact:true}).first().click();await save.click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__workspace.writes.length),1);row.updated=true;
   await page.getByRole('button',{name:'게임 설정·수정',exact:true}).first().click();await page.setViewportSize({width:390,height:844});b=await footer.boundingBox();assert(b.y>=0&&b.y+b.height<=845);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);row.mobile=true;
   if(['wheel','quiz','balloonpop','icecream','shopping','sentencetower'].includes(game.type))await page.screenshot({path:resolve(root,'../output/game-settings-audit/'+game.type+'-mobile.png')});
   if(['balloonpop','feedmonster'].includes(game.type)){
    await page.getByRole('button',{name:'닫기',exact:true}).click();await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-game-ready-overlay]').getByRole('button',{name:'게임 시작',exact:true}).click();await page.locator('[data-play-mode="play"]').waitFor();
    await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 설정·수정',exact:true}).click();
    await editor.getByRole('button',{name:adventure?'설정 적용 · 게임 다시 준비':'설정 적용 · 미리보기',exact:true}).waitFor();
    if(adventure)await editor.getByLabel('최대 문제 개수',{exact:true}).fill('3');
    else await editor.getByRole('checkbox',{name:'효과음',exact:true}).setChecked(!await editor.getByRole('checkbox',{name:'효과음',exact:true}).isChecked());
    await page.getByRole('button',{name:'닫기',exact:true}).click();await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 설정·수정',exact:true}).click();
    if(adventure)assert.equal(await editor.getByLabel('최대 문제 개수',{exact:true}).inputValue(),'3');
    assert(await save.isDisabled());await editor.getByRole('button',{name:adventure?'설정 적용 · 게임 다시 준비':'설정 적용 · 미리보기',exact:true}).click();row.playSettings=true;row.draftRetained=true;
   }
   row.passed=true;console.log('PASS',game.type);
  }catch(e){row.passed=false;row.error=e.message;await page.screenshot({path:resolve(root,'../output/game-settings-audit/'+game.type+'-failure.png'),fullPage:true}).catch(()=>{});console.log('FAIL',game.type,e.message.slice(0,300));}
  results.push(row);
 }
 writeFileSync(resolve(root,'../output/game-settings-audit/results'+(process.env.SETTINGS_AUDIT_ONLY?'-'+process.env.SETTINGS_AUDIT_ONLY:'')+'.json'),JSON.stringify({results,errors},null,2));
 console.log(JSON.stringify({checked:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed),errors}));
 if(results.some(r=>!r.passed)||errors.length)process.exitCode=1;
}finally{await browser?.close();await server.close();}
