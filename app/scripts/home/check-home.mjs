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
  server: { hmr: false, host: "127.0.0.1", port: 5198, strictPort: true },
});


let browser,page;
try{
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1586,height:1050}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.__homeNavigations=[];const push=history.pushState;history.pushState=function(data,...args){window.__homeNavigations.push(structuredClone(data));return push.call(this,data,...args);};});
 const fixture='http://127.0.0.1:5198/scripts/home/home.html';
 const go=async(extra='populated=1')=>{await page.goto(fixture+'?start=/dashboard&'+extra);await page.locator('[data-home-dashboard]').waitFor();const tip=page.getByRole('button',{name:'알겠어요',exact:true});if(await tip.isVisible())await tip.click();for(const image of await page.locator('[data-home-dashboard] img').all())await image.scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('[data-home-dashboard] img')].every(img=>img.complete&&img.naturalWidth>0));await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>scrollTo(0,0));};
 const home=()=>page.locator('[data-home-dashboard]');
 const overflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page has horizontal overflow');
 await go();assert.equal(await home().locator('img').count(),6);assert.equal(await home().locator('.home-records').first().locator('.home-record').count(),3);assert.equal(await home().locator('.home-records').nth(1).locator('.home-record').count(),3);await overflow();
 await page.screenshot({path:resolve(root,'../output/home-desktop.png'),fullPage:true});await page.screenshot({path:resolve(root,'../output/home-desktop-viewport.png')});
 console.log('ok real home with all six images, three materials and three lessons; initial desktop capture');
 if(process.env.HOME_CAPTURE_ONLY)process.exitCode=0;
 else {
 for(const [label,kind] of [['+ 단어장 만들기','word'],['+ 문장 모음 만들기','sentence']]){await home().getByRole('link',{name:label,exact:true}).click();await page.waitForURL('**/wordlists');assert.equal(await page.evaluate(()=>history.state.usr.createMaterialKind),kind);await go();}
 await home().getByRole('link',{name:'내 자료 불러오기',exact:true}).click();await page.waitForURL('**/wordlists');await go();
 await home().getByRole('link',{name:'게임 고르기',exact:true}).click();await page.waitForURL('**/games');await go();await home().getByRole('link',{name:'활동지 고르기',exact:true}).click();await page.waitForURL('**/materials');await page.locator('[data-app-content]').getByRole('heading',{name:'활동지(인쇄)',exact:true}).waitFor();await go();
 const types=['wheel','matchup','unscramble','treasuredig'];for(const type of types){const link=home().locator(`.home-game-card a[href="/games/${type}"]`);await link.click();await page.waitForURL('**/games/'+type);await page.locator('[data-game-guide]').waitFor();await go();}
 await home().getByRole('button',{name:'+ 게임 만들기',exact:true}).click();await page.locator('[data-game-create]').waitFor();await page.getByRole('button',{name:'닫기',exact:true}).click();
 const material=()=>home().locator('.home-records').first().locator('.home-record').first();
 await material().getByRole('link',{name:'다른 게임 하기',exact:true}).click();await page.waitForURL('**/games');let payload=await page.evaluate(()=>history.state.usr.quickSource);assert.equal(payload.ownerId,'teacher-a');assert.equal(payload.academyId,'academy-a');assert.equal(payload.cards.length,4);await go();
 await material().getByRole('link',{name:'활동지 만들기',exact:true}).click();await page.waitForURL('**/materials/worksheet');assert.equal(await page.evaluate(()=>history.state.usr.materialsWords.length),4);await go();
 await material().getByRole('button',{name:'수업에 추가',exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.evaluate(()=>window.__workspace.lessons.length),3);await page.getByRole('button',{name:'닫기',exact:true}).click();
 await home().locator('.home-records').nth(1).getByRole('link',{name:'수업 이어하기·시작하기',exact:true}).first().click();await page.waitForURL('**/curriculum');assert(await page.evaluate(()=>window.__homeNavigations.some(s=>s.usr?.startLessonId==='lesson-1')));await go();await home().getByRole('link',{name:'수업 만들기',exact:true}).click();await page.waitForURL('**/curriculum');assert(await page.evaluate(()=>window.__homeNavigations.some(s=>s.usr?.openQuick===true)));await go();
 console.log('ok create/load/game/material routes, existing game create, reuse ownership and cards, add-lesson dialog without automatic writes, lesson resume/create state');
 await go('empty=1');await home().getByText('아직 자료가 없어요.',{exact:false}).waitFor();assert.equal(await home().locator('.home-record').count(),0);await home().getByRole('link',{name:'샘플로 바로 해보기',exact:true}).click();await page.waitForURL('**/games/wheel');await go('fail=1');await home().getByRole('alert').waitFor();await page.evaluate(()=>window.__workspace.fail=false);await home().getByRole('button',{name:'다시 시도',exact:true}).click();await home().locator('.home-record').first().waitFor();
 console.log('ok authentic empty state and sample entry; load error and retry');
 await go();await page.getByRole('button',{name:'EN',exact:true}).click();await home().getByRole('heading',{name:'Recent materials',exact:true}).waitFor();await overflow();await page.screenshot({path:resolve(root,'../output/home-english.png'),fullPage:true});await page.getByRole('button',{name:'KO',exact:true}).click();
 await go('populated=1&long=1');await page.getByRole('button',{name:'아주 크게',exact:true}).click();await overflow();await page.screenshot({path:resolve(root,'../output/home-large-text.png'),fullPage:true});await page.getByRole('button',{name:'보통',exact:true}).click();
 for(const [name,width,height] of [['laptop',1366,900],['tablet',820,1180],['mobile',390,844]]){await page.setViewportSize({width,height});await go();await overflow();await page.screenshot({path:resolve(root,`../output/home-${name}.png`),fullPage:true});}
 assert.deepEqual(errors,[]);console.log('ok English, large text and long names, laptop/tablet/mobile, no runtime errors');
 }
}catch(error){console.error(error);if(page){await page.screenshot({path:resolve(root,'../output/home-failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-3000));}process.exitCode=1;}
finally{await browser?.close();await server.close();}
