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
const classes=new URLSearchParams(location.search).has('roster')?[...registeredClasses,{id:'class-empty',academy_id:'academy-a',name:'빈 반'}]:[];
const students=[{id:'alice',academy_id:'academy-a',class_id:'class-a',name:'Alice'},{id:'bob',academy_id:'academy-a',class_id:'class-a',name:'Bob'},{id:'cara',academy_id:'academy-a',class_id:'class-b',name:'Cara'},{id:'foreign',academy_id:'academy-other',class_id:'class-a',name:'FOREIGN'}];
const lists=[{id:'words',academy_id:'academy-a',class_id:'class-a',kind:'word',name:'합성 과일',updated_at:'2026-10-19',items:[{id:'apple',word:'apple',meaning:'사과',image_url:'/word-bank-images/apple.webp',category:'fruit'},{id:'banana',word:'banana',meaning:'바나나',image_url:'/word-bank-images/banana.webp',category:'fruit'},{id:'cat',word:'cat',meaning:'고양이',image_url:'/word-bank-images/cat.webp',category:'animal'},{id:'dog',word:'dog',meaning:'강아지',image_url:null,category:'animal'}]},{id:'sentences',academy_id:'academy-a',class_id:'class-a',kind:'sentence',name:'합성 문장',updated_at:'2026-10-19',items:[{id:'s',word:'I like cats.',meaning:'나는 고양이를 좋아해요.',image_url:null}]}];
window.__workspace={templates:[],writes:[],fail:false,empty:new URLSearchParams(location.search).has('empty')};
if(new URLSearchParams(location.search).has('student'))window.__workspace.templates.push({id:'student-game',academy_id:'academy-a',class_id:'class-a',game_type:'wheel',name:'학생용 저장 게임',items:[{id:'a',label:'apple'},{id:'b',label:'cat'}],config:{}});
if(new URLSearchParams(location.search).has('saved'))window.__workspace.templates.push({id:'original-game',academy_id:'academy-a',class_id:null,game_type:'wheel',name:'원본 저장 게임',items:[{id:'original',label:'ORIGINAL'}],config:{}});
window.__originalSources=JSON.stringify({lists,classes,students});window.__readSources=()=>JSON.stringify({lists,classes,students});
const functions={
fetchMyStudentRow:async()=>({class_id:'class-a'}),
wordListKindOf:(list)=>list.kind==='sentence'?'sentence':'word',
updateWordListItems:async(id,items)=>{if(window.__workspace.fail)throw new Error('synthetic word update failure'); const list=lists.find(row=>row.id===id);if(list)list.items=items;},
fetchClasses:async()=>classes,fetchStudentsOfClass:async(id)=>{if(window.__workspace.failRoster)throw new Error('roster failure');await new Promise(resolve=>setTimeout(resolve,id==='class-a'?120:10));return structuredClone(students.filter(s=>s.class_id===id));},fetchStudentsOfAcademy:async()=>students,
createWordList:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic save failure'); const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,kind:p.kind,items:p.items,updated_at:'now'};(window.__workspace.wordWrites||=[]).push(row);lists.push(row);return row;},
fetchAllWordLists:async()=>{if(window.__workspace.failLists)throw new Error('list failure');return window.__workspace.empty?[]:structuredClone(lists);},fetchAllCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
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
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',route=>route.abort());
 const fixture='http://127.0.0.1:5198/scripts/games/focus.html';const guide=()=>page.locator('[data-game-guide]');const picker=()=>guide().locator('[data-game-source-picker]');
 const go=async(type,kind,extra='')=>{await page.goto(fixture+'?start=/games/'+type+extra);await guide().getByRole('button',{name:kind,exact:false}).click();await page.locator('[data-guide-step="1"]').waitFor();};
 const originals=async()=>assert(await page.evaluate(()=>window.__originalSources===window.__readSources()));
 await go('wheel','단어로 만들기');await picker().getByRole('button',{name:'내 단어장 불러오기',exact:true}).click();assert.equal(await picker().getByRole('button',{name:/합성 문장/}).count(),0);await picker().getByRole('button',{name:/합성 과일/}).click();assert.equal(await guide().getByLabel('단어',{exact:true}).first().inputValue(),'apple');await originals();
 await guide().getByLabel('단어',{exact:true}).first().fill('local change');await originals();assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);
 console.log('ok word-only library, load/edit a temporary copy, original material unchanged');
 await go('wheel','문장으로 만들기');await picker().getByRole('button',{name:'내 문장 모음 불러오기',exact:true}).click();assert.equal(await picker().getByRole('button',{name:/합성 과일/}).count(),0);await picker().getByRole('button',{name:/합성 문장/}).click();assert.equal(await guide().getByLabel('문장',{exact:true}).first().inputValue(),'I like cats.');await originals();console.log('ok sentence-only collection, native sentence rows');
 await go('wheel','학생·팀 이름으로 만들기','&roster=1');await picker().getByRole('button',{name:'우리 반에서 불러오기',exact:true}).click();await picker().getByLabel('반 선택',{exact:false}).selectOption('class-a');await picker().getByLabel('Alice',{exact:true}).waitFor();assert.equal(await picker().getByLabel('FOREIGN',{exact:true}).count(),0);await picker().getByLabel('Bob',{exact:true}).uncheck();await picker().getByRole('button',{name:'선택한 학생 1명 가져오기',exact:true}).click();assert.deepEqual(await guide().getByLabel('학생·팀 이름',{exact:true}).evaluateAll(els=>els.map(el=>el.value)),['Alice']);await originals();
 await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByRole('button',{name:'게임 시작',exact:false}).click();assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);console.log('ok class roster, participant selection, foreign academy filtered, native name game without any save');
 await go('wheel','학생·팀 이름으로 만들기','&roster=1');await picker().getByRole('button',{name:'우리 반에서 불러오기',exact:true}).click();await picker().getByLabel('반 선택',{exact:false}).selectOption('class-a');await picker().getByLabel('반 선택',{exact:false}).selectOption('class-b');await picker().getByLabel('Cara',{exact:true}).waitFor();assert.equal(await picker().getByLabel('Alice',{exact:true}).count(),0);await picker().getByLabel('반 선택',{exact:false}).selectOption('class-empty');await picker().getByText('이 반에 가져올 학생이 없어요.',{exact:false}).waitFor();assert(await picker().getByRole('button',{name:'선택한 학생 0명 가져오기',exact:true}).isDisabled());await originals();console.log('ok rapid class switch rejects stale roster; empty roster cannot import');
 await go('wheel','학생·팀 이름으로 만들기');await picker().getByRole('button',{name:'우리 반에서 불러오기',exact:true}).click();await picker().getByText('등록된 반이 없어요.',{exact:false}).waitFor();await picker().getByRole('button',{name:'직접 입력',exact:true}).click();await guide().getByLabel('학생·팀 이름',{exact:true}).first().fill('1팀');console.log('ok classless account retains direct team entry');
 await go('wheel','단어로 만들기');await guide().getByLabel('단어',{exact:true}).first().fill('keep me');await page.evaluate(()=>window.__workspace.failLists=true);await picker().getByRole('button',{name:'내 단어장 불러오기',exact:true}).click();await picker().getByRole('alert').waitFor();assert.equal(await guide().getByLabel('단어',{exact:true}).first().inputValue(),'keep me');await page.evaluate(()=>window.__workspace.failLists=false);await picker().getByRole('button',{name:'다시 시도',exact:true}).click();await picker().getByRole('button',{name:/합성 과일/}).waitFor();console.log('ok load error/retry preserves unsubmitted input');
 await page.goto(fixture+'?start=/dashboard&roster=1');await page.getByRole('button',{name:'+ 게임 만들기',exact:true}).click();await page.locator('[data-game-create]').getByRole('button',{name:'학생·팀 이름으로 만들기',exact:false}).click();const launchPicker=page.locator('[data-game-create] [data-game-source-picker]');await launchPicker.getByRole('button',{name:'우리 반에서 불러오기',exact:true}).click();await launchPicker.getByLabel('반 선택',{exact:false}).selectOption('class-b');await launchPicker.getByLabel('Cara',{exact:true}).waitFor();await launchPicker.getByRole('button',{name:'선택한 학생 1명 가져오기',exact:true}).click();await page.locator('[data-game-create]').getByRole('button',{name:/돌림판/}).click();await page.locator('[data-guide-step="1"]').waitFor();assert.equal(await guide().getByLabel('학생·팀 이름',{exact:true}).first().inputValue(),'Cara');await originals();console.log('ok home create -> class import -> compatible game carries selected roster');

 await go('wheel','학생·팀 이름으로 만들기','&roster=1');await picker().getByRole('button',{name:'우리 반에서 불러오기',exact:true}).click();await picker().getByLabel('반 선택',{exact:false}).waitFor();await page.evaluate(()=>window.__workspace.failRoster=true);await picker().getByLabel('반 선택',{exact:false}).selectOption('class-a');await picker().getByRole('alert').waitFor();await page.evaluate(()=>window.__workspace.failRoster=false);await picker().getByRole('button',{name:'다시 시도',exact:true}).click();await picker().getByLabel('Alice',{exact:true}).waitFor();console.log('ok roster load failure/retry');
 await go('wheel','단어로 만들기','&roster=1');await picker().getByRole('button',{name:'내 단어장 불러오기',exact:true}).click();await picker().getByRole('button',{name:/합성 과일/}).click();await guide().getByRole('button',{name:'다음',exact:true}).click();await picker().getByRole('button',{name:'우리 반에서 불러오기',exact:true}).click();await picker().getByLabel('반 선택',{exact:false}).selectOption('class-b');await picker().getByLabel('Cara',{exact:true}).waitFor();await picker().getByRole('button',{name:'선택한 학생 1명 가져오기',exact:true}).click();await guide().getByRole('button',{name:'다음',exact:true}).click();await guide().getByRole('button',{name:'게임 시작',exact:false}).click();await page.locator('[data-current-next]').getByText('Cara',{exact:false}).first().waitFor();await originals();assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);console.log('ok vocabulary remains separate from imported participants; selected class B roster overrides class A only temporarily');
 await page.setViewportSize({width:390,height:844});await go('wheel','학생·팀 이름으로 만들기','&roster=1');await picker().getByRole('button',{name:'우리 반에서 불러오기',exact:true}).click();await picker().getByLabel('반 선택',{exact:false}).selectOption('class-a');await picker().getByLabel('Alice',{exact:true}).waitFor();await page.screenshot({path:resolve(root,'../output/game-source-class-mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log('ok mobile roster picker and runtime errors');
}catch(error){console.error(error);if(page){console.error((await page.locator('body').innerText()).slice(-6000));await page.screenshot({path:resolve(root,'../output/game-source-failure.png'),fullPage:true});}process.exitCode=1;}
finally{await browser?.close();await server.close();}
