import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
mkdirSync(resolve(root,"../output/ux-remaining"),{recursive:true});
const names = [
  ...readFileSync(resolve(root, "src/lib/api.ts"), "utf8").matchAll(
    /export (?:async )?function (\w+)|export const (\w+)/g,
  ),
].map((m) => m[1] || m[2]);
const stub = `
import {curriculumEntries} from '/src/data/phonicsCurriculum.ts';
import { isActivityDraft, patchActivityDraft } from '/src/lib/quickActivity.ts';
const academy={id:'academy-a',features:{group:true,homework:true},plan:'paid'};
const registeredClasses=[{id:'class-a',academy_id:'academy-a',name:'합성 A반'},{id:'class-b',academy_id:'academy-a',name:'합성 B반'}];
const classes=registeredClasses;
const students=[{id:'alice',name:'Alice',academy_id:'academy-a',class_id:'class-a'},{id:'bob',name:'Bob',academy_id:'academy-a',class_id:'class-a'}];
const lists=[{id:'words',academy_id:'academy-a',class_id:'class-a',kind:'word',name:'합성 과일',updated_at:'2026-10-19',items:[{id:'apple',word:'apple',meaning:'사과',image_url:'/word-bank-images/apple.webp',category:'fruit'},{id:'banana',word:'banana',meaning:'바나나',image_url:'/word-bank-images/banana.webp',category:'fruit'},{id:'cat',word:'cat',meaning:'고양이',image_url:'/word-bank-images/cat.webp',category:'animal'},{id:'dog',word:'dog',meaning:'강아지',image_url:null,category:'animal'}]},{id:'sentences',academy_id:'academy-a',class_id:'class-a',kind:'sentence',name:'합성 문장',updated_at:'2026-10-19',items:[{id:'s',word:'I like cats.',meaning:'나는 고양이를 좋아해요.',image_url:null}]}];
window.__workspace=JSON.parse(sessionStorage.getItem('UX점검.backend')||'null')||{templates:[],writes:[],fail:false,empty:false,lessons:[]};window.__persist=()=>sessionStorage.setItem('UX점검.backend',JSON.stringify(window.__workspace));
if(new URLSearchParams(location.search).has('student'))window.__workspace.templates.push({id:'student-game',academy_id:'academy-a',class_id:'class-a',game_type:'wheel',name:'학생용 저장 게임',items:[{id:'a',label:'apple'},{id:'b',label:'cat'}],config:{}});
if(new URLSearchParams(location.search).has('saved'))window.__workspace.templates.push({id:'original-game',academy_id:'academy-a',class_id:null,game_type:'wheel',name:'원본 저장 게임',items:[{id:'original',label:'ORIGINAL'}],config:{}});
const uxLabels=['road','trip','load','waterfall','flat','car','train','bus','plane','map','tent','ticket','hotel','beach','mountain','suitcase','camera','sandwich','bottle','picnic','family','holiday','travel','drive','bridge'];lists.splice(0,lists.length,{id:'ux-family-a',academy_id:'academy-a',class_id:null,kind:'word',name:'Family Road Trip',items:uxLabels.map((word,i)=>({id:'ux-'+i,word,meaning:'뜻 '+word,image_url:i<22?'/word-bank-images/road.webp':null,patternMarked:word==='trip'?'{tr}ip':word==='flat'?'{fl}at':'',category:null})),updated_at:'v1'},{id:'ux-family-b',academy_id:'academy-a',class_id:null,kind:'word',name:'Family Road Trip',items:[{id:'other',word:'other',meaning:'다른 자료',image_url:null}],updated_at:'v1'},{id:'ux-sentences',academy_id:'academy-a',class_id:null,kind:'sentence',name:'UX점검 문장',items:[{id:'ux-s1',word:'We drive on the road.',meaning:'우리는 도로에서 운전해요.',image_url:null},{id:'ux-s2',word:'I have a red bag.',meaning:'나는 빨간 가방이 있어요.',image_url:null}],updated_at:'v1'});window.__UXlists=lists;window.__originalLists=JSON.stringify(lists);
const functions={fetchPhonicsBankResult:async()=>({entries:curriculumEntries(),mediaAvailable:true}),
fetchMyStudentRow:async()=>({class_id:'class-a'}),
wordListKindOf:(list)=>list.kind==='sentence'?'sentence':'word',
updateWordListItems:async(id,items)=>{if(window.__workspace.fail)throw new Error('synthetic word update failure'); const list=lists.find(row=>row.id===id);if(list)list.items=items;},
fetchSavedGames:async()=>structuredClone(window.__workspace.templates),fetchClasses:async()=>classes,fetchStudentsOfClass:async()=>students,fetchStudentsOfAcademy:async()=>students,
createWordList:async(p)=>{if(window.__workspace.fail)throw new Error('synthetic save failure'); const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,kind:p.kind,items:p.items,updated_at:'now'};(window.__workspace.wordWrites||=[]).push(row);lists.push(row);return row;},
fetchAllWordLists:async()=>{if(window.__workspace.failLists)throw Error('UX점검 source load failure');return structuredClone(lists);},fetchAllCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
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
const toast = `const run=async(fn)=>{try{await fn();return true}catch(e){console.error(e);return false}};const value={notify:()=>{},run};export const useToast=()=>value;export const ToastProvider=({children})=>children;`;
const server = await createServer({cacheDir:'node_modules/.vite/qa-worksheet-ux',
  root,
  logLevel: "error",
  plugins: [
    {
      name: "synthetic-workspace",
      enforce: "pre",
      load(id) {
        const p = id.replaceAll("\\", "/");
        if(p.endsWith('/scripts/games/focus.tsx'))return readFileSync(id,'utf8').replace("import PrelaunchExtras", "import MaterialsPage from '../../src/pages/MaterialsPage';\nimport PrelaunchExtras").replace('<Route path="/materials/worksheet"','<Route path="/materials" element={<MaterialsPage />}/><Route path="/materials/worksheet"');
        if (p.endsWith("/src/lib/api.ts")) return stub;
        if (p.endsWith("/src/context/AuthContext.tsx")) return auth;
        if (p.endsWith("/src/context/ToastContext.tsx")) return toast;
        if (p.endsWith("/src/lib/supabase.ts"))
          return "export const supabase={rpc:async(name)=>({data:name==='my_deletion_request'?null:[],error:null}),channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}})};";
      },
    },
  ],
  server: { hmr: false, host: "127.0.0.1", port: 5386, strictPort: true },
});



let browser,page;const results=[];const pass=x=>{results.push(x);console.log('PASS',x);};
try{
 await server.listen();browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());await page.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{const style=document.createElement('style');style.textContent='.material-symbols-outlined{display:inline-block!important;width:24px!important;min-width:24px!important;overflow:hidden!important;font-size:0!important}';document.head.append(style);});});const base='http://127.0.0.1:5386/scripts/games/focus.html?start=',go=path=>page.goto(base+encodeURIComponent(path)),hub=()=>page.locator('[data-worksheet-hub]'),editor=()=>page.locator('[data-worksheet-editor]'),source=()=>page.locator('[data-worksheet-source]');
 await go('/materials');await page.getByRole('link',{name:'워크시트 만들기',exact:false}).first().click();await hub().waitFor();assert.equal(await source().getAttribute('data-source-id'),'');await hub().locator('[data-basic-activity="basic-tracing"]').getByRole('button',{name:'샘플 보기',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();pass('materials entry opens the same hub with purposes and sample browsing before source choice');await go('/wordlists');await page.locator('span[title="Family Road Trip"]').first().waitFor({state:"attached"});const list=page.locator('span[title="Family Road Trip"]').first().locator('..').locator('..').locator('..');await list.getByRole('button',{name:'인쇄물 만들기',exact:false}).click();await list.getByRole('button',{name:'워크시트',exact:false}).click();await hub().waitFor();await page.waitForFunction(()=>document.querySelector('[data-worksheet-source]')?.dataset.sourceId==='ux-family-a');assert((await source().innerText()).includes('25'));assert((await hub().locator('[data-basic-activity="basic-tracing"]').innerText()).includes('road'));assert.equal(await hub().locator('[data-basic-activity="basic-tracing"] text').first().textContent(),'road');await page.screenshot({path:resolve(root,'../output/worksheet-ux/hub-selected.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:resolve(root,'../output/worksheet-ux/hub-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1100});pass('actual word-list print entry keeps ID, name and 25 cards; tracing card shows whole selected word; mobile has no horizontal overflow');
 const choose=async(id)=>{await hub().locator('[data-basic-activity="'+id+'"],[data-activity-card="'+id+'"]').getByRole('button',{name:'이 활동지 만들기',exact:false}).click();await editor().waitFor();};
 await choose('basic-tracing');await page.locator('.ws-preview-stack[data-audience=student] text').first().waitFor();assert.equal(await page.locator('.ws-preview-stack[data-audience=student] text').first().textContent(),'road');assert.equal(await page.locator('.ws-help[open]').count(),0);await editor().getByRole('button',{name:'다른 활동 찾기',exact:false}).click();await hub().waitFor();assert.equal(await source().getAttribute('data-source-id'),'ux-family-a');
 await hub().locator('[data-activity-card="scramble"]').getByRole('button',{name:'샘플 보기',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();assert.equal(await source().getAttribute('data-source-id'),'ux-family-a');await choose('scramble');assert.equal(await source().getAttribute('data-source-id'),'ux-family-a');assert((await page.locator('[data-worksheet-usage]').innerText()).includes('25'));pass('format roundtrip and sample open/close preserve selected source');
 await source().getByRole('button',{name:'자료 변경',exact:true}).click();const dialog=page.getByRole('dialog',{name:'자료 변경',exact:true});assert.equal(await dialog.getByRole('button',{name:'이 목록으로 교체',exact:true}).count(),0);await dialog.getByRole('button',{name:'Family Road Trip · 1',exact:true}).click();await dialog.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await source().getAttribute('data-source-id'),'ux-family-a');
 await source().getByRole('button',{name:'자료 변경',exact:true}).click();await dialog.getByRole('button',{name:'Family Road Trip · 1',exact:true}).click();await dialog.getByRole('button',{name:'이 목록으로 교체',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-worksheet-source]')?.dataset.sourceId==='ux-family-b');assert((await page.locator('[data-worksheet-usage]').innerText()).includes('1'));pass('cancel preserves original; same-name lists are distinguished by ID');
 await go('/materials/worksheet?source=ux-family-a');await hub().waitFor();await choose('basic-tracing');await page.reload();await editor().waitFor();assert.equal(await source().getAttribute('data-source-id'),'ux-family-a');assert.equal(await page.locator('.ws-preview-stack[data-audience=student] text').first().textContent(),'road');await page.evaluate(()=>{const key='classbank:worksheets:v1:teacher-a:academy-a',saved=JSON.parse(localStorage.getItem(key));saved.current['basic-tracing'].title='UX점검 기존 편집본';localStorage.setItem(key,JSON.stringify(saved));});await go('/materials/worksheet?activity=basic-tracing');await editor().getByRole('heading',{name:'단어 따라 쓰기',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelector('[data-worksheet-source]')?.dataset.sourceId==='ux-family-a');assert((await page.locator('.ws-preview-viewport').innerText()).includes('UX점검 기존 편집본'));pass('reload and direct old-editor restoration preserve source ID and edited content without sample fallback');
 // Fresh source lookup failure must not restore a sample as teacher material.
 await page.evaluate(()=>{for(const key of Object.keys(sessionStorage))if(key.includes(':source:'))sessionStorage.removeItem(key);window.__workspace.failLists=true;window.__persist();});await go('/materials/worksheet?activity=basic-tracing&source=ux-family-a');await page.locator('[data-source-blocked]').getByText('단어장을 불러오지 못했어요',{exact:true}).waitFor();assert.equal(await page.locator('.ws-preview-viewport .print-board').count(),0);await page.evaluate(()=>{window.__workspace.failLists=false;});await page.getByRole('button',{name:'다시 시도',exact:true}).click();await editor().waitFor();await page.locator('.ws-preview-stack[data-audience=student] text').first().waitFor();assert.equal(await source().getAttribute('data-source-id'),'ux-family-a');pass('load failure has retry, no sample or printable page; retry restores real selected source');
 await editor().getByRole('button',{name:'다른 활동 찾기',exact:false}).click();await hub().getByRole('button',{name:'모든 양식 보기',exact:true}).click();await hub().getByRole('button',{name:'문장 만들기',exact:false}).click();await choose('sentenceOrder');await page.locator('[data-worksheet-requirement]').waitFor();assert(await editor().getByRole('button',{name:'학생용 인쇄',exact:true}).isDisabled());await page.getByRole('button',{name:'문장 모음 선택',exact:true}).click();await dialog.getByRole('button',{name:'UX점검 문장 · 2',exact:true}).click();await dialog.getByRole('button',{name:'이 목록으로 교체',exact:true}).click();await page.locator('.ws-preview-viewport .print-board').first().waitFor();pass('zero valid sentence questions blocks print and directly opens sentence collection choice');
 assert.equal(await page.evaluate(()=>JSON.stringify(window.__UXlists)===window.__originalLists),true);assert.equal(await page.evaluate(()=>window.__workspace.writes.length),0);assert.deepEqual(errors,[]);writeFileSync(resolve(root,'../output/worksheet-ux/browser.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify({passed:true,results,errors}));
}catch(e){console.error(e);if(page){console.error((await page.locator('body').innerText()).slice(-5000));await page.screenshot({path:resolve(root,'../output/worksheet-ux/failure.png'),fullPage:true});}process.exitCode=1;}finally{await browser?.close();await server.close();}
