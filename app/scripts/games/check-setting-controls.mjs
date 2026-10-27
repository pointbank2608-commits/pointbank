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
  server: { hmr: false, host: "127.0.0.1", port: 5329, strictPort: true },
});



let browser,page;
try{
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 const results=[];
 for(const type of ['catchsentence','wheel','timer']){
  await page.goto(`http://127.0.0.1:5329/scripts/games/focus.html?start=/games/${type}`);await page.getByRole('button',{name:'닫기',exact:true}).click();await page.locator('[data-game-preparation] summary').first().click();await page.getByRole('button',{name:'자세히 설정',exact:true}).first().click();
  const editor=page.locator('[data-game-existing-settings]');
  if(type==='catchsentence'){const settings=editor.locator('[data-catch-settings]');await settings.getByRole('button',{name:'3단계',exact:true}).click();assert.equal(await settings.getByRole('spinbutton').inputValue(),'5');await settings.getByRole('spinbutton').fill('4.5');}
  if(type==='wheel')await editor.getByRole('checkbox',{name:'당첨된 항목 제거하며 진행',exact:true}).check();
  if(type==='timer'){const settings=editor.locator('[data-timer-play-settings]');await settings.getByRole('button',{name:'참가자별 순위',exact:true}).click();await settings.getByRole('button',{name:'숫자 보임',exact:true}).click();}
  await page.locator('[data-preparation-submit]').getByRole('button',{name:'게임 저장',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  const saved=await page.evaluate(()=>window.__workspace.writes[0]);assert.ok(saved);
  if(type==='catchsentence'){assert.equal(saved.config.catchLevel,3);assert.equal(saved.config.catchSeconds,4.5);}
  if(type==='wheel')assert.equal(saved.config.wheelEliminate,true);
  if(type==='timer'){assert.equal(saved.config.timerMode,'ranked');assert.equal(saved.config.timerShowClock,true);}
  await page.getByRole('button',{name:'자세히 설정',exact:true}).first().click();
  if(type==='catchsentence'){assert.equal(await editor.locator('[data-catch-settings]').getByRole('button',{name:'3단계',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await editor.locator('[data-catch-settings]').getByRole('spinbutton').inputValue(),'4.5');}
  if(type==='wheel')assert.equal(await editor.getByRole('checkbox',{name:'당첨된 항목 제거하며 진행',exact:true}).isChecked(),true);
  if(type==='timer'){assert.equal(await editor.locator('[data-timer-play-settings]').getByRole('button',{name:'참가자별 순위',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await editor.locator('[data-timer-play-settings]').getByRole('button',{name:'숫자 보임',exact:true}).getAttribute('aria-pressed'),'true');}
  const settingsView=type==='wheel'?editor.getByRole('checkbox',{name:'당첨된 항목 제거하며 진행',exact:true}):editor.locator(type==='timer'?'[data-timer-play-settings]':'[data-catch-settings]');await settingsView.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(root,`../output/${type}-settings-desktop.png`)});await page.setViewportSize({width:390,height:844});await settingsView.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(root,`../output/${type}-settings-mobile.png`)});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('[data-preparation-submit]').getByRole('button',{name:'게임 저장',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__workspace.writes.length),1);await page.setViewportSize({width:1440,height:1000});results.push({type,save:true,reopen:true,sameId:true,mobile:true,config:saved.config});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,results,errors}));
}catch(error){console.error(await page?.locator('body').innerText());await page?.screenshot({path:resolve(root,'../output/settings-controls-failure.png'),fullPage:true});throw error;}finally{await browser?.close();await server.close();}
