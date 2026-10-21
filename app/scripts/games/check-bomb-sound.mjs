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
updateGameTemplate:async(id,p)=>{if(window.__workspace.fail)throw new Error('synthetic sound save failure');if(isActivityDraft(id))patchActivityDraft(id,p);else Object.assign(window.__workspace.templates.find(t=>t.id===id)||{},p)}
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
  server: { hmr: false, host: "127.0.0.1", port: 5202, strictPort: true },
});


let browser,page;
try {
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.__audio=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(!window.__audio.includes(this))window.__audio.push(this);return play.call(this)};});
 const fixture='http://127.0.0.1:5202/scripts/home/home.html';const guide=()=>page.locator('[data-game-guide]');const musicName='음악 (PassTheBallBGM)';
 const alive=async(path)=>page.waitForFunction(path=>window.__audio.some(a=>a.src.includes(path)&&!a.paused&&a.currentTime>0),path);
 const silence=async()=>assert(await page.evaluate(()=>window.__audio.filter(a=>a.loop).every(a=>a.paused)));
 await page.goto(fixture+'?start=/games/bomb&empty=1');await guide().getByRole('button',{name:'샘플로 먼저 해보기',exact:false}).click();assert(await guide().getByRole('radio',{name:'초시계 소리',exact:true}).isChecked());await guide().getByRole('radio',{name:musicName,exact:true}).check();assert(await guide().getByRole('radio',{name:musicName,exact:true}).isChecked());await page.screenshot({path:resolve(root,'../output/bomb-sound-settings.png')});await guide().getByRole('button',{name:'게임 시작',exact:false}).click();
 await page.getByRole('button',{name:'폭탄 돌리기 시작',exact:true}).click();await alive('pass-the-ball-bgm.mp3');assert.equal(await page.evaluate(()=>window.__audio.find(a=>a.src.includes('pass-the-ball-bgm')).loop),true);console.log('ok default clock, guided music selection, real MP3 decoding/playback and looping');
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await silence();await page.getByRole('button',{name:'계속하기',exact:true}).click();await alive('pass-the-ball-bgm.mp3');
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 설정·수정',exact:true}).click();const editor=()=>page.locator('[data-game-existing-settings]');await editor().getByRole('radio',{name:'초시계 소리',exact:true}).check();assert(await editor().getByRole('radio',{name:'초시계 소리',exact:true}).isChecked());await page.getByRole('button',{name:'닫기',exact:true}).click();await alive('bomb-tick.m4a');assert(await page.evaluate(()=>window.__audio.filter(a=>a.src.includes('pass-the-ball-bgm')).every(a=>a.paused)));
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'소리 끄기 (모든 게임)',exact:true}).click();await page.getByRole('button',{name:'계속하기',exact:true}).click();await silence();await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'소리 켜기',exact:true}).click();await page.getByRole('button',{name:'계속하기',exact:true}).click();await alive('bomb-tick.m4a');console.log('ok pause/resume, switching active sound replaces old audio, mute/unmute');
 await page.getByRole('button',{name:'☰ 메뉴',exact:true}).click();await page.getByRole('button',{name:'게임 설정·수정',exact:true}).click();await editor().getByRole('radio',{name:musicName,exact:true}).check();await editor().locator('[data-preparation-submit] summary').click();await page.getByRole('textbox',{name:'활동 이름 (선택)',exact:true}).fill('소리 선택 검증');await page.getByRole('button',{name:'내 활동으로 저장',exact:true}).click();await page.waitForFunction(()=>window.__workspace.writes.length===1);assert.equal(await page.evaluate(()=>window.__workspace.writes[0].config.bombSound),'music');
 await page.locator('[data-game-preparation] summary').click();await page.getByRole('button',{name:'저장한 게임 불러오기',exact:true}).click();await page.getByRole('button',{name:'소리 선택 검증',exact:true}).click();if(!await page.locator('[data-game-preparation] summary').evaluate(el=>el.parentElement.open))await page.locator('[data-game-preparation] summary').click();await page.getByRole('button',{name:'게임 설정·수정',exact:true}).click();assert(await editor().getByRole('radio',{name:musicName,exact:true}).isChecked());await page.evaluate(()=>window.__workspace.fail=true);await editor().getByRole('radio',{name:'초시계 소리',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('[data-game-existing-settings] [data-bomb-sound] input')].at(1)?.checked===true);await page.evaluate(()=>window.__workspace.fail=false);await editor().getByRole('radio',{name:'초시계 소리',exact:true}).check();assert.equal(await page.evaluate(()=>window.__workspace.templates.find(row=>row.name==='소리 선택 검증').config.bombSound),'clock');
 console.log('ok explicit save/reopen retains selection; failed update rolls back; saved game settings persist');

 assert.equal(await page.evaluate(()=>window.__workspace.templates.find(row=>row.name==='소리 선택 검증').items.length),6);
 await page.setViewportSize({width:390,height:844});await editor().getByRole('radio',{name:musicName,exact:true}).check();await editor().getByRole('radio',{name:'초시계 소리',exact:true}).check();await page.locator('dialog[open]').evaluate(el=>{const field=el.querySelector('[data-game-existing-settings] [data-bomb-sound]');el.scrollTop+=field.getBoundingClientRect().top-el.getBoundingClientRect().top-180});await page.screenshot({path:resolve(root,'../output/bomb-sound-mobile.png'),fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS bomb sound');
}catch(error){console.error(error);if(page){await page.screenshot({path:resolve(root,'../output/bomb-sound-failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-2400));}process.exitCode=1;}
finally{await browser?.close();await server.close();}
