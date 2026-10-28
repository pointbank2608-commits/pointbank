import {execFileSync} from 'node:child_process';
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
mkdirSync(resolve(root,"../output/ux-remaining"),{recursive:true});
const originalPhonics=execFileSync('git',['show','HEAD:app/src/data/phonicsLessons.ts'],{encoding:'utf8'}).replace(/from (['"])\.\//g,'from $1/src/data/');
const names = [
  ...readFileSync(resolve(root, "src/lib/api.ts"), "utf8").matchAll(
    /export (?:async )?function (\w+)|export const (\w+)/g,
  ),
].map((m) => m[1] || m[2]);
const stub = `
import { isActivityDraft, patchActivityDraft } from '/src/lib/quickActivity.ts';
import {curriculumEntries} from '/src/data/phonicsCurriculum.ts';
const academy={id:'academy-a',features:{group:true,homework:true},plan:'paid'};
const registeredClasses=[{id:'class-a',academy_id:'academy-a',name:'합성 A반'},{id:'class-b',academy_id:'academy-a',name:'합성 B반'}];
const classes=registeredClasses;
const students=[{id:'alice',name:'Alice',academy_id:'academy-a',class_id:'class-a'},{id:'bob',name:'Bob',academy_id:'academy-a',class_id:'class-a'}];
const lists=[{id:'words',academy_id:'academy-a',class_id:'class-a',kind:'word',name:'합성 과일',updated_at:'2026-10-19',items:[{id:'apple',word:'apple',meaning:'사과',image_url:'/word-bank-images/apple.webp',category:'fruit'},{id:'banana',word:'banana',meaning:'바나나',image_url:'/word-bank-images/banana.webp',category:'fruit'},{id:'cat',word:'cat',meaning:'고양이',image_url:'/word-bank-images/cat.webp',category:'animal'},{id:'dog',word:'dog',meaning:'강아지',image_url:null,category:'animal'}]},{id:'sentences',academy_id:'academy-a',class_id:'class-a',kind:'sentence',name:'합성 문장',updated_at:'2026-10-19',items:[{id:'s',word:'I like cats.',meaning:'나는 고양이를 좋아해요.',image_url:null}]}];
window.__workspace=JSON.parse(sessionStorage.getItem('UX점검.backend')||'null')||{templates:[],writes:[],fail:false,empty:false,lessons:[]};window.__persist=()=>sessionStorage.setItem('UX점검.backend',JSON.stringify(window.__workspace));
if(new URLSearchParams(location.search).has('student'))window.__workspace.templates.push({id:'student-game',academy_id:'academy-a',class_id:'class-a',game_type:'wheel',name:'학생용 저장 게임',items:[{id:'a',label:'apple'},{id:'b',label:'cat'}],config:{}});
if(new URLSearchParams(location.search).has('saved'))window.__workspace.templates.push({id:'original-game',academy_id:'academy-a',class_id:null,game_type:'wheel',name:'원본 저장 게임',items:[{id:'original',label:'ORIGINAL'}],config:{}});
const functions={fetchPhonicsBank:async()=>curriculumEntries(false),
fetchMyStudentRow:async()=>({class_id:'class-a'}),
wordListKindOf:(list)=>list.kind==='sentence'?'sentence':'word',
updateWordListItems:async(id,items)=>{if(window.__workspace.fail)throw new Error('synthetic word update failure'); const list=lists.find(row=>row.id===id);if(list)list.items=items;},
fetchSavedGames:async()=>structuredClone(window.__workspace.templates),fetchClasses:async()=>classes,fetchStudentsOfClass:async()=>students,fetchStudentsOfAcademy:async()=>students,
createWordList:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic save failure'); const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,kind:p.kind,items:p.items,updated_at:'now'};(window.__workspace.wordWrites||=[]).push(row);lists.push(row);return row;},
fetchAllWordLists:async()=>window.__workspace.empty?[]:structuredClone(lists),fetchAllCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
fetchCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
fetchCurriculumLessonById:async(id)=>structuredClone((window.__workspace.lessons||[]).find(x=>x.id===id)),
updateCurriculumLesson:async(id,p)=>{if(window.__workspace.fail)throw Error('UX점검 lesson update failed');Object.assign(window.__workspace.lessons.find(x=>x.id===id),p);window.__persist();},
createCurriculumLesson:async(p)=>{if(window.__workspace.fail)throw Error('UX점검 create lesson failed');const l={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,word_list_id:p.wordListId,video_url:null,level:p.level,playlist:p.playlist,updated_at:'now'};(window.__workspace.lessons||=[]).push(l);window.__persist();return structuredClone(l);},
appendActivityToLesson:async(l,s)=>{if(window.__workspace.fail)throw Error('UX점검 append failed');window.__workspace.lessons.find(row=>row.id===l.id).playlist.push(s);window.__persist();},
fetchWordLists:async(_a,_c,k='all')=>structuredClone(k==='all'?lists:lists.filter(x=>x.kind===k)),
fetchGameTemplates:async(_a,_c,type)=>window.__workspace.templates.filter(x=>x.game_type===type),
createGameTemplate:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic failure');const t={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,game_type:p.gameType,name:p.name,items:p.items,config:p.config||{},updated_at:'2026-10-19'};window.__workspace.templates.push(t);window.__workspace.writes.push(t);window.__persist();return structuredClone(t);},
fetchGameTemplateById:async(id)=>window.__workspace.templates.find(t=>t.id===id),
updateGameTemplate:async(id,p)=>{if(isActivityDraft(id)){patchActivityDraft(id,p);return;}if(window.__workspace.fail)throw Error('UX점검 update failed');Object.assign(window.__workspace.templates.find(t=>t.id===id)||{},p);window.__persist();}
};
${names.map((n) => `export const ${n}=(...args)=>(functions.${n}|| (async()=>[]))(...args);`).join("\n")}
`;
const auth = `const value={academy:{id:'academy-a',features:{group:true},plan:'paid',deletion_requested_at:null,deletion_scheduled_at:null},profile:{id:'teacher-a'},isStaff:!new URLSearchParams(location.search).has('student'),isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:false,inTrial:false,daysLeft:7},pointUnit:'별'};export const useAuth=()=>value;export const AuthProvider=({children})=>children;`;
const toast = `const run=async(fn)=>{try{await fn();return true}catch(e){console.error(e);return false}};const value={notify:(...a)=>{window.__notices||=[];window.__notices.push(a)},run};export const useToast=()=>value;export const ToastProvider=({children})=>children;`;
const server = await createServer({cacheDir:'node_modules/.vite/qa-remaining-phonics',
  root,
  logLevel: "error",
  plugins: [
    {
      name: "synthetic-workspace",
      enforce: "pre",
      resolveId(id){if(id==='/src/data/__ux_baseline.ts')return root+'/src/data/__ux_baseline.ts';},
      load(id) {if(id.replaceAll('\\','/').endsWith('/src/data/__ux_baseline.ts'))return originalPhonics;
        const p = id.replaceAll("\\", "/");
        if (p.endsWith("/src/lib/api.ts")) return stub;
        if (p.endsWith("/src/context/AuthContext.tsx")) return auth;
        if (p.endsWith("/src/context/ToastContext.tsx")) return toast;
        if (p.endsWith("/src/lib/supabase.ts"))
          return "export const supabase={rpc:async(name)=>({data:name==='my_deletion_request'?null:[],error:null}),channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}})};";
      },
    },
  ],
  server: { hmr: false, host: "127.0.0.1", port: 5368, strictPort: true },
});


let browser,page;const results=[];const pass=name=>{results.push(name);console.log('PASS',name);};
try{
 await server.listen();
 const current=await server.ssrLoadModule('/src/data/phonicsLessons.ts'),baseline=await server.ssrLoadModule('/src/data/__ux_baseline.ts');
 const units=current.courseUnits();for(const unit of units.filter(u=>u.id!=='course-2-1'))assert.deepEqual(current.lessonSlides(unit),baseline.lessonSlides(unit),unit.id);pass('41 other units unchanged, including every slide ID and content');
 const unit=units.find(u=>u.id==='course-2-1'),slides=current.lessonSlides(unit),old=baseline.lessonSlides(unit),memory=slides.filter(s=>s.lesson===2&&s.kind==='memory');
 const words=['bad','sad','tag','wag','ram','ham'];assert.equal(slides.length,old.length+9);assert.equal(new Set(slides.map(s=>s.id)).size,slides.length);assert.deepEqual(memory.filter(s=>s.phase===0).map(s=>current.courseWord(unit,s.entryIds[0]).word),words);for(const word of words)assert.deepEqual(memory.filter(s=>current.courseWord(unit,s.entryIds[0]).word===word).map(s=>s.phase),[0,1,2]);
 assert.deepEqual(slides.filter(s=>s.lesson===1),old.filter(s=>s.lesson===1));for(const slide of old.filter(s=>!(s.lesson===2&&s.kind==='memory')))assert.deepEqual(slides.find(s=>s.id===slide.id),slide,slide.id);pass('L2 U1: original 3-word introduction kept, six expansion words x read/hide/reveal; all downstream old links preserved');
 browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',route=>route.abort());await page.addInitScript(()=>{window.__spoken=[];speechSynthesis.speak=u=>{window.__spoken.push(u.text);u.onend?.();};});
 const rootUrl='http://127.0.0.1:5368',fixture=rootUrl+'/scripts/games/remaining-ux.html?start=';
 await page.goto(fixture+encodeURIComponent('/phonics?tab=course&level=2&unit=course-2-1'));const lesson2=page.locator('a[href="/phonics/lesson?unit=course-2-1&lesson=2"]');await lesson2.waitFor();await lesson2.click();await page.locator('.pc-player-controls select').waitFor();
 const options=page.locator('.pc-player-controls select');assert.equal((await options.locator('option').allTextContents()).filter(s=>s.includes('Read and Remember')).length,18);
 for(const word of words){const phases=memory.filter(s=>current.courseWord(unit,s.entryIds[0]).word===word);await options.selectOption(phases[0].id);await page.locator('.pc-memory[data-game-phase="0"]').waitFor();assert.equal((await page.locator('.pc-memory').textContent()).replace(/\s/g,''),word);await page.locator('[data-course-next]').click();await page.locator('.pc-memory[data-game-phase="1"] .pc-recall').waitFor();assert.equal(await page.locator('.pc-memory img').count(),0);await page.locator('[data-course-next]').click();await page.locator('.pc-memory[data-game-phase="2"]').waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('.pc-memory img')).every(img=>img.complete&&img.naturalWidth>0));assert.equal(await page.locator('.pc-memory img').getAttribute('data-picture-word'),'pw-'+word);await page.locator('.pc-memory .s1-speaker').click();assert.equal(await page.evaluate(()=>window.__spoken.at(-1)),word);await page.locator('.pc-player-controls:has(select) button').first().click();await page.locator('.pc-memory[data-game-phase="1"]').waitFor();}
 pass('actual browser: Ready Class entry, 18 memory slides, six correct pictures/voices, read→hide→reveal and previous navigation');
 const last=memory.at(-1);await page.goto(fixture+encodeURIComponent('/phonics/lesson?unit=course-2-1&lesson=2&slide='+encodeURIComponent(last.id)));await page.locator('.pc-memory[data-game-phase="2"]').waitFor();assert((await page.locator('.pc-memory').textContent()).includes('ham'));await page.locator('[data-course-next]').click();await page.locator('.pc-writing').waitFor();assert.equal(await options.inputValue(),'course-2-1:61');
 await page.goto(fixture+'/phonics?level=2');await page.getByRole('tab',{name:'슬라이드 수업·교재',exact:true}).click();await page.locator('[data-phonics-teaching] select').first().selectOption('2');await lesson2.waitFor();await lesson2.click();assert.equal((await options.locator('option').allTextContents()).filter(s=>s.includes('Read and Remember')).length,18);pass('new semantic deep link, old post-memory address 61 and both phonics entry paths use the same sequence');
 assert.deepEqual(errors,[]);writeFileSync(resolve(root,'../output/ux-remaining/phonics-results.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,results,errors}));
}catch(error){console.error(error);if(page){console.error((await page.locator('body').innerText()).slice(-6000));await page.screenshot({path:resolve(root,'../output/ux-remaining/phonics-failure.png'),fullPage:true});}process.exitCode=1;}finally{await browser?.close();await server.close();}
