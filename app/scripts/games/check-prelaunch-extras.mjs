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
window.__workspace.lessons=Array.from({length:24},(_,i)=>({id:'lesson-'+i,academy_id:'academy-a',class_id:'class-a',name:'검증 수업 '+String(i).padStart(2,'0'),playlist:[{id:'slide-'+i,kind:'game',gameType:'wheel',templateId:'legacy'}],updated_at:'2026-10-27'}));
const functions={
updateCurriculumLesson:async(id,p)=>{Object.assign(window.__workspace.lessons.find(l=>l.id===id),p);},

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
const server = await createServer({cacheDir:'node_modules/.vite/qa-check-prelaunch-extras',
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
  server: { hmr: false, host: "127.0.0.1", port: 5335, strictPort: true },
});



let browser,page;
try{
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1280,height:800}});page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 const url='http://127.0.0.1:5335/scripts/games/focus.html?start=';
 const {detectiveSuggestion}=await server.ssrLoadModule('/src/lib/detectiveSuggestion.ts');
 assert.deepEqual(detectiveSuggestion('She go to school.','She goes to school.'),{start:4,end:6,replacement:'goes',choices:['go','goes']});
 assert.equal(detectiveSuggestion('I happy.','I am happy.'),null);assert.equal(detectiveSuggestion('He like apples and she like bananas.','He likes apples and she likes bananas.'),null);assert.equal(detectiveSuggestion('Go go go.','Go goes go.').start,3);
 await page.goto(url+'/qa/prelaunch');const trigger=page.getByRole('button',{name:'검증 메뉴',exact:true});await trigger.click();const menu=page.getByRole('menu');await menu.waitFor();assert.equal(await menu.evaluate(n=>n.matches(':popover-open')),true);const bounds=await menu.boundingBox(),card=await page.locator('[data-clipped-card]').boundingBox();assert(bounds.y+bounds.height>card.y+card.height);assert(bounds.y+bounds.height<=800);await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'삭제');await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(n=>n===document.activeElement),true);
 await trigger.click();await menu.getByRole('menuitem',{name:'공유',exact:true}).click();assert.equal(await page.locator('[data-menu-result]').textContent(),'공유');await trigger.click();await page.locator('[data-menu-result]').click();assert.equal(await menu.count(),0);
 const editor=page.locator('.ad-editor'),first=editor.locator('.ad-edit-card').first();assert.equal(await first.getByLabel('올바른 문장',{exact:true}).inputValue(),'She goes to school every day.');await first.getByRole('button',{name:'수정 부분 자동 제안',exact:true}).click();assert.equal(await first.getByLabel('정답',{exact:true}).inputValue(),'goes');assert.equal((await first.textContent()).includes('[4, 6)'),false);
 await page.screenshot({path:resolve(root,'../output/prelaunch-grammar-desktop.png')});const third=editor.locator('.ad-edit-card').nth(2);await third.getByRole('button',{name:'수정 부분 자동 제안',exact:true}).click();assert.equal(await third.getByLabel('정답',{exact:true}).count(),2);await editor.getByRole('status').waitFor();await editor.getByRole('button',{name:'설정 적용 · 게임 다시 준비',exact:true}).click();const config=JSON.parse(await page.locator('[data-grammar-result]').textContent());assert.equal(config.cases[0].errors[0].replacement,'goes');assert.equal(config.cases[2].errors.length,2);
 await page.goto(url+'/curriculum');await page.getByRole('button',{name:'고치기',exact:true}).last().waitFor();const edit=page.getByRole('button',{name:'고치기',exact:true}).last();await edit.scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);assert(y>200);await edit.click();await page.locator('[data-lesson-edit-form] input').first().waitFor();await page.waitForTimeout(200);const form=await page.locator('[data-lesson-edit-form]').boundingBox();assert(form.y>=-5&&form.y<200);assert.equal(await page.locator('[data-lesson-edit-form] input').first().evaluate(n=>n===document.activeElement),true);await page.screenshot({path:resolve(root,'../output/prelaunch-lesson-edit-desktop.png')});await page.locator('[data-lesson-edit-form]').getByRole('button',{name:'취소',exact:true}).click();await page.waitForTimeout(200);assert(Math.abs(await page.evaluate(()=>scrollY)-y)<20);
 await page.getByRole('button',{name:'더보기',exact:true}).last().click();await page.getByRole('menu').waitFor();assert.equal(await page.getByRole('menu').evaluate(n=>n.matches(':popover-open')),true);await page.keyboard.press('Escape');
 await page.screenshot({path:resolve(root,'../output/prelaunch-lessons-desktop.png')});await page.setViewportSize({width:390,height:844});await page.goto(url+'/qa/prelaunch');await page.getByRole('button',{name:'검증 메뉴',exact:true}).click();const mobile=await page.getByRole('menu').boundingBox();assert(mobile.x>=0&&mobile.x+mobile.width<=390);await page.screenshot({path:resolve(root,'../output/prelaunch-menu-mobile.png')});await page.close();page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());await page.addInitScript(()=>{delete HTMLElement.prototype.showPopover;});await page.goto(url+'/qa/prelaunch');await page.getByRole('button',{name:'검증 메뉴',exact:true}).click();await page.getByRole('menu').waitFor();await page.getByRole('menuitem',{name:'공유',exact:true}).click();assert.equal(await page.locator('[data-menu-result]').textContent(),'공유');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,popoverFallback:true,popoverOutsideClip:true,keyboard:true,outsideClick:true,grammarConservativeDiff:true,preservedMultiRanges:true,lessonEditFocus:true,scrollRestore:true,mobile:true,errors}));
}catch(e){console.error(e);console.error((await page?.locator('body').innerText())?.slice(-4500));await page?.screenshot({path:resolve(root,'../output/prelaunch-extras-failure.png'),fullPage:true});process.exitCode=1;}finally{await browser?.close();await server.close();}
