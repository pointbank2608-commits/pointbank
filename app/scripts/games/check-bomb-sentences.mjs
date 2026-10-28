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
lists.push({...lists[1],id:'foreign-list',academy_id:'academy-other',name:'FOREIGN SENTENCES'});
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
  server: { hmr: false, host: "127.0.0.1", port: 5262, strictPort: true },
});


let browser,page;
try {
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',route=>route.abort());
 const fixture='http://127.0.0.1:5262/scripts/games/focus.html';const guide=()=>page.locator('[data-game-guide]');const picker=()=>guide().locator('[data-game-source-picker]');
 const go=async(label,extra='')=>{await page.goto(fixture+'?start=/games/bomb'+extra);await guide().getByRole('button',{name:label,exact:false}).click();await page.locator('[data-guide-step="1"]').waitFor();};
 const draft=()=>page.evaluate(async()=>{const m=await import('/src/lib/quickActivity.ts');return m.readActivityDraft(m.draftId('teacher-a','academy-a','bomb'));});
 const isDefaultPeople=(items)=>items.length===3&&items.every((x,i)=>x.label===`참가자 ${i+1}`);
 // 1) 시작 메뉴: 단어·문장·이름 세 가지가 모두 열려 있다.
 await page.goto(fixture+'?start=/games/bomb');
 for(const label of ['단어로 만들기','문장으로 만들기','학생·팀 이름으로 만들기'])assert.equal(await guide().getByRole('button',{name:label,exact:false}).isEnabled(),true,label);
 // 2) 이름으로 만들기: 이름만 입력한다. 단어·문장 입력칸이 나오지 않는다.
 await go('학생·팀 이름으로 만들기');
 assert.equal(await page.locator('[data-bomb-practice]').count(),0);
 assert.equal(await guide().getByRole('button',{name:/내 문장 모음 불러오기|내 단어장 불러오기/}).count(),0);
 await guide().getByLabel('학생·팀 이름',{exact:true}).first().fill('민지');await guide().getByRole('button',{name:'+ 항목 추가',exact:true}).click();await guide().getByLabel('학생·팀 이름',{exact:true}).last().fill('지우');
 await guide().getByRole('button',{name:'완료',exact:true}).click();await page.waitForTimeout(200);
 let saved=await draft();assert.deepEqual(saved.items.map(x=>x.label),['민지','지우']);assert(!saved.config.words?.length);
 console.log('ok names mode: names only');
 // 3) 단어로 만들기: 단어 불러오기만 있고 문장 불러오기는 없다. 단어는 "읽을 내용"으로 들어가고 참가자는 기본 이름이다.
 await go('단어로 만들기');
 assert.equal(await page.locator('[data-bomb-practice]').count(),0);
 assert.equal(await picker().getByRole('button',{name:'내 문장 모음 불러오기'}).count(),0);
 await picker().getByRole('button',{name:'내 단어장 불러오기',exact:true}).click();
 assert.equal(await picker().getByRole('button',{name:/합성 문장|FOREIGN SENTENCES/}).count(),0);
 await picker().getByRole('button',{name:/합성 과일/}).click();
 assert.deepEqual(await guide().getByLabel('단어',{exact:true}).evaluateAll(els=>els.map(x=>x.value)),['apple','banana','cat','dog']);
 await guide().getByRole('button',{name:'완료',exact:true}).click();await page.waitForTimeout(200);
 saved=await draft();assert.deepEqual(saved.config.words.map(x=>x.label),['apple','banana','cat','dog']);assert(isDefaultPeople(saved.items),'참가자는 기본 이름');assert.equal(saved.config.classroomSource.kind,'word');
 console.log('ok word mode: words only, read-content not participants');
 // 4) 문장으로 만들기: 문장 불러오기만 있고 단어장 불러오기는 없다.
 await go('문장으로 만들기');
 assert.equal(await picker().getByRole('button',{name:'내 단어장 불러오기'}).count(),0);
 await picker().getByRole('button',{name:'내 문장 모음 불러오기',exact:true}).click();
 assert.equal(await picker().getByRole('button',{name:/합성 과일|FOREIGN SENTENCES/}).count(),0);
 await picker().getByRole('button',{name:/합성 문장/}).click();
 assert.deepEqual(await guide().getByLabel('문장',{exact:true}).evaluateAll(els=>els.map(x=>x.value)),['I like cats.']);
 await page.screenshot({path:resolve(root,'../output/bomb-sentence-import.png'),fullPage:true});
 await guide().getByRole('button',{name:'완료',exact:true}).click();await page.waitForTimeout(200);
 saved=await draft();assert.deepEqual(saved.config.words.map(x=>x.label),['I like cats.']);assert(isDefaultPeople(saved.items));assert.equal(saved.config.classroomSource.kind,'sentence');
 assert(await page.evaluate(()=>window.__originalSources===window.__readSources()));assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);
 console.log('ok sentence mode: sentences only, academy filter, no original writes');
 // 5) 아무것도 입력하지 않고 완료하면 막고 안내한다.
 await page.evaluate(()=>{sessionStorage.clear();localStorage.clear();});await go('문장으로 만들기');await guide().getByRole('button',{name:'완료',exact:true}).click();await guide().locator('[data-guide-error]').waitFor();
 console.log('ok empty reading content is blocked');
 // 6) 게임이 실제로 시작된다.
 await go('문장으로 만들기');await picker().getByRole('button',{name:'내 문장 모음 불러오기',exact:true}).click();await picker().getByRole('button',{name:/합성 문장/}).click();
 await guide().getByRole('button',{name:'완료',exact:true}).click();await page.waitForTimeout(200);
 await page.locator('[data-game-ready-overlay]').getByRole('button',{name:'게임 시작',exact:true}).click();await page.getByText('게임 진행 중',{exact:false}).first().waitFor();
 console.log('ok game starts with sentence content');
 // 7) 게임 설정 안의 문장 불러오기는 참가자를 그대로 둔다.
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'자세히 설정',exact:true}).click();const editor=page.locator('[data-game-existing-settings]');await editor.getByRole('button',{name:'문장 목록에서 불러오기',exact:false}).click();await editor.getByRole('button',{name:/합성 문장/}).click();
 const after=await draft();assert(isDefaultPeople(after.items));assert(after.config.words.some(w=>w.label==='I like cats.'));
 console.log('ok native settings sentence sources keep participants');
 // 8) 불러오기 실패·재시도·빈 목록·영어·모바일
 await go('문장으로 만들기');await page.evaluate(()=>window.__workspace.failLists=true);await picker().getByRole('button',{name:'내 문장 모음 불러오기',exact:true}).click();await picker().getByRole('alert').waitFor();await page.evaluate(()=>window.__workspace.failLists=false);await picker().getByRole('button',{name:'다시 시도',exact:true}).click();await picker().getByRole('button',{name:/합성 문장/}).waitFor();
 await page.setViewportSize({width:390,height:844});await picker().getByRole('button',{name:/합성 문장/}).click();await guide().getByLabel('문장',{exact:true}).first().scrollIntoViewIfNeeded();await page.screenshot({path:resolve(root,'../output/bomb-sentence-mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(async()=>{const m=await import('/src/i18n/index.ts');await m.default.changeLanguage('en');});await picker().getByRole('button',{name:'Load my sentence collections',exact:true}).waitFor();
 await go('문장으로 만들기','&empty=1');await picker().getByRole('button',{name:'내 문장 모음 불러오기',exact:true}).click();await picker().getByText('저장한 문장 모음이 없어요.',{exact:false}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS bomb word/sentence/names inputs are separate; load failure/retry, empty collection, English, mobile');
}catch(error){console.error(error);if(page){await page.screenshot({path:resolve(root,'../output/bomb-sentence-failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-2400));}process.exitCode=1;}
finally{await browser?.close();await server.close();}
