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
const classes=[{id:'class-a',academy_id:'academy-a',name:'합성 A반'},{id:'class-b',academy_id:'academy-a',name:'합성 B반'}];
const students=[{id:'alice',name:'Alice'},{id:'bob',name:'Bob'},{id:'cara',name:'Cara'}];
const lists=[{id:'words',academy_id:'academy-a',class_id:'class-a',kind:'word',name:'합성 과일',updated_at:'2026-10-19',items:[{id:'apple',word:'apple',meaning:'사과',image_url:'/word-bank-images/apple.webp',category:'fruit'},{id:'banana',word:'banana',meaning:'바나나',image_url:'/word-bank-images/banana.webp',category:'fruit'},{id:'cat',word:'cat',meaning:'고양이',image_url:'/word-bank-images/cat.webp',category:'animal'},{id:'dog',word:'dog',meaning:'강아지',image_url:null,category:'animal'}]},{id:'sentences',academy_id:'academy-a',class_id:'class-a',kind:'sentence',name:'합성 문장',updated_at:'2026-10-19',items:[{id:'s',word:'I like cats.',meaning:'나는 고양이를 좋아해요.',image_url:null}]}];
window.__workspace={templates:[],writes:[],fail:false};
const functions={
fetchClasses:async()=>classes,fetchStudentsOfClass:async()=>students,fetchStudentsOfAcademy:async()=>students,
fetchAllWordLists:async()=>lists,
fetchWordLists:async(_a,_c,k)=>k==='all'?lists:lists.filter(x=>x.kind===k),
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
  server: { hmr:false, host: "127.0.0.1", port: 5188, strictPort: true },
});
let browser,page;
try {
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.route('https://**/*',route=>route.abort());
 const url='http://127.0.0.1:5188/scripts/games/workspace.html';
 await page.goto(url+'?game=quiz');await page.locator('.game-workspace-stage [data-game="quiz"]').waitFor();
 assert.equal(await page.locator('dialog[open]').count(),0);
 await page.evaluate(()=>{window.__ticks=0;window.__clock.setTimeout(()=>window.__ticks++,80)});await page.waitForTimeout(140);assert.equal(await page.evaluate(()=>window.__ticks),0);
 await page.getByRole('button',{name:'게임 시작',exact:true}).click();await page.waitForTimeout(140);assert.equal(await page.evaluate(()=>window.__ticks),1);
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.evaluate(()=>window.__clock.setTimeout(()=>window.__ticks++,80));await page.waitForTimeout(140);assert.equal(await page.evaluate(()=>window.__ticks),1);
 await page.getByRole('button',{name:'계속하기',exact:true}).click();await page.waitForTimeout(140);assert.equal(await page.evaluate(()=>window.__ticks),2);
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'준비 화면으로',exact:true}).click();
 await page.getByRole('button',{name:'내 자료 불러오기',exact:true}).click();await page.getByRole('button',{name:/합성 과일/}).click();
 assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);
 await page.getByRole('button',{name:'다른 게임 하기',exact:true}).click();await page.getByRole('button',{name:'돌림판',exact:true}).click();await page.waitForURL('**/games/wheel');
 await page.locator('.game-workspace-stage [data-game="wheel"]').waitFor();
 const draft=await page.evaluate(()=>JSON.parse(Object.entries(sessionStorage).find(([key])=>key.startsWith('activity-draft:')&&key.endsWith(':wheel'))[1]));assert.equal(draft.items[0].label,'apple');assert.equal(draft.config.questions,undefined);
 await page.getByRole('button',{name:'내 자료 불러오기',exact:true}).click();await page.getByRole('dialog').locator('select').selectOption('class-a');await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'참여자·팀·순서',exact:true}).click();await page.getByLabel('Bob',{exact:true}).check();assert.equal(await page.getByLabel('Bob',{exact:true}).isChecked(),true);await page.keyboard.press('Escape');
 console.log('ok board portal, paused clock/resume, temporary source conversion and real class roster exclusion');
 const gamePaths=[...readFileSync(resolve(root,'src/lib/gamePages.ts'),'utf8').matchAll(/'\/games\/(\w+)'\s*:/g)].map(match=>match[1]);
 for(const game of gamePaths){const before=errors.length;await page.goto(url+'?game='+game);await page.getByRole('button',{name:'게임 설정·수정',exact:true}).first().click();await page.getByRole('dialog',{name:'게임 준비',exact:true}).waitFor();await page.getByRole('button',{name:'닫기',exact:true}).first().click();assert.equal(errors.length,before,game+': '+errors.slice(before).join('; '));}
 console.log('ok all '+gamePaths.length+' game pages: existing settings open/close with no runtime errors');
 await page.addInitScript(()=>{const cards=[{id:'a',word:'apple',meaning:'사과',imageUrl:null},{id:'b',word:'banana',meaning:'바나나',imageUrl:null}];sessionStorage.setItem('classbank.lessonRunner',JSON.stringify({lessonId:'synthetic-lesson',lessonName:'합성 수업',classId:'class-a',steps:[{kind:'game',slideId:'game-a',path:'/games/quiz',label:'Quiz'},{kind:'canvas',slideId:'next',path:'/curriculum/synthetic/slide/next',label:'Next'}],stepIndex:0,startedAt:Date.now(),words:['apple','banana'],viewSnapshot:{slides:[{kind:'game',id:'game-a',gameType:'quiz'}],words:cards}}));history.replaceState({usr:{materialsWords:cards},key:'synthetic'},'','/games/quiz');});
 await page.goto(url+'?game=quiz');await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'다른 게임 하기',exact:true}).click();await page.getByRole('button',{name:'돌림판',exact:true}).click();await page.waitForURL('**/games/wheel');
 const lesson=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('classbank.lessonRunner')));assert.equal(lesson.steps[0].path,'/games/wheel');assert.equal(lesson.stepIndex,0);assert.equal(lesson.steps[1].slideId,'next');assert.equal(lesson.viewSnapshot.slides[0].gameType,'wheel');
 console.log('ok existing lesson presentation: game replacement preserves subsequent activities and follow-along snapshot');assert.deepEqual(errors,[]);
} catch(error){console.error('FAILED',error.message);if(page)console.error((await page.locator('body').innerText()).slice(-5000));process.exitCode=1;}
finally{await browser?.close();await server.close();}
