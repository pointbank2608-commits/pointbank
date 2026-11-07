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
  server: { hmr: false, host: "127.0.0.1", port: 5263, strictPort: true },
});

let browser;
try {
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const fixture='http://127.0.0.1:5263/scripts/games/focus.html';
 const types=process.argv.slice(2).length?process.argv.slice(2):['balloonpop','feedmonster','sentencebridge','sentencetower'];
 const bad=[];
 for(const type of types){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}});await ctx.route('https://**/*',r=>r.abort());const page=await ctx.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));
  await page.goto(fixture+`?start=/games/${type}`);await page.waitForTimeout(2500);
  const r=await page.evaluate(()=>({dialog:!!document.querySelector('dialog[open]'),toolbar:!!document.querySelector('[data-game-toolbar]'),mode:document.querySelector('[data-play-mode]')?.getAttribute('data-play-mode'),overlay:!!document.querySelector('[data-game-ready-overlay]'),board:!!document.querySelector('[data-game]')}));
  console.log(type,JSON.stringify(r),errs.slice(0,2).join('|'));
  await page.screenshot({path:resolve(root,'../output/instant-'+type+'.png')});
  if(r.dialog||r.overlay||!r.board||r.mode!=='play'||errs.length)bad.push(type);
  if(process.env.PANELS){for(const label of ['내 단어/문장','게임설정','저장/불러오기']){await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(600);const txt=await page.evaluate(()=>{const d=document.querySelector('dialog[open]');return (d?d.innerText:document.body.innerText).replace(/\s+/g,' ').slice(0,300)});console.log('  ['+label+']',txt);await page.screenshot({path:resolve(root,'../output/instant-'+type+'-'+label.replace(/\W/g,'')+'.png')});await page.keyboard.press('Escape');await page.waitForTimeout(200);}}
  await ctx.close();
 }
 assert.equal(bad.length,0,'not instant: '+bad);console.log('PASS');
}catch(e){console.error(e);process.exitCode=1;}
finally{await browser?.close();await server.close();}
