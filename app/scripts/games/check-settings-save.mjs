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
  server: { hmr: false, host: "127.0.0.1", port: 5326, strictPort: true },
});

let browser,page;
try {
 const {queueGameTemplateWrite:queue,flushGameTemplateWrites:flush}=await server.ssrLoadModule('/src/lib/gameTemplateWrites.ts');
 const order=[];let release;const first=queue('same',()=>new Promise(resolve=>{release=()=>{order.push('old');resolve();};}));
 const second=queue('same',async()=>{order.push('new');});await queue('other',async()=>order.push('independent'));assert.deepEqual(order,['independent']);release();await flush('same');await Promise.all([first,second]);assert.deepEqual(order,['independent','old','new']);
 await assert.rejects(queue('failed',async()=>{throw new Error('expected');}));await queue('failed',async()=>order.push('recovered'));
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 await page.goto('http://127.0.0.1:5326/scripts/games/focus.html?start=/games/shopping');
 await page.getByRole('button',{name:'닫기',exact:true}).click();await page.locator('[data-game-preparation] summary').first().click();await page.getByRole('button',{name:'게임 설정·수정',exact:true}).first().click();
 const footer=page.locator('[data-preparation-submit]'),editor=page.locator('[data-game-existing-settings]');
 await footer.getByRole('button',{name:'게임 저장하고 닫기',exact:true}).waitFor();
 let box=await footer.boundingBox();assert(box.y+box.height<=1001,'footer visible before scrolling');
 await editor.getByRole('button',{name:'옷 가게',exact:true}).click();await editor.getByRole('button',{name:'8',exact:true}).click();
 await page.screenshot({path:resolve(root,'../output/settings-save-desktop.png')});
 assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);
 await footer.getByRole('button',{name:'게임 저장하고 닫기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('게임이 저장됐어요.',{exact:false}).waitFor();
 const saved=await page.evaluate(()=>window.__workspace.writes[0]);assert.equal(saved.config.shopScene,'clothes');assert.equal(saved.config.shopListSize,8);
 await page.getByRole('button',{name:'게임 설정·수정',exact:true}).first().click();await editor.getByRole('button',{name:'5',exact:true}).click();
 await page.evaluate(()=>window.__workspace.fail=true);
 await footer.getByRole('button',{name:'게임 저장하고 닫기',exact:true}).click();await footer.getByRole('alert').waitFor();assert(await page.getByRole('dialog').isVisible());
 await page.evaluate(()=>window.__workspace.fail=false);await footer.getByRole('button',{name:'게임 저장하고 닫기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>window.__workspace.writes.length),1);assert.equal(await page.evaluate(()=>window.__workspace.templates.find(t=>t.id===window.__workspace.writes[0].id).config.shopListSize),5);
 await page.getByRole('button',{name:'게임 설정·수정',exact:true}).first().click();await page.setViewportSize({width:390,height:844});
 box=await footer.boundingBox();assert(box.y>=0&&box.y+box.height<=845,'mobile footer visible');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:resolve(root,'../output/settings-save-mobile.png')});
 await footer.getByRole('button',{name:'설정 적용하고 닫기',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__workspace.writes.length),1);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,temporarySave:true,updateSameGame:true,failureRetainsDialog:true,retry:true,footerDesktopMobile:true,queuedWrites:true,errors}));
} catch(error) {console.error(await page?.locator('body').innerText());await page?.screenshot({path:resolve(root,'../output/settings-save-failure.png'),fullPage:true});throw error;}finally{await browser?.close();await server.close();}
