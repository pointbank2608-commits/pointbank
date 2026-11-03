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
const server = await createServer({cacheDir:'node_modules/.vite/qa-worksheet-pdf',
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
  server: { hmr: false, host: "127.0.0.1", port: 5387, strictPort: true },
});




const out=resolve(root,'../tmp/pdfs/worksheet-ux');mkdirSync(out,{recursive:true});let browser,page;const checks=[];
try{await server.listen();const {exampleWorksheet}=await server.ssrLoadModule('/src/lib/worksheetActivitySamples.ts');const {prepareWorksheet}=await server.ssrLoadModule('/src/lib/worksheetPreparation.ts');const {documentFromSource,worksheetSource}=await server.ssrLoadModule('/src/lib/worksheetSources.ts');const {curriculumEntries}=await server.ssrLoadModule('/src/data/phonicsCurriculum.ts');const bank=curriculumEntries();const labels=['road','trip','load','waterfall','flat','car','train','bus','plane','map','tent','ticket','hotel','beach','mountain','suitcase','camera','sandwich','bottle','picnic','family','holiday','travel','drive','bridge'];const selected=worksheetSource('ux-print','UX점검 Family Road Trip','word',labels.map((word,i)=>({id:'ux-'+i,word,meaning:'뜻 '+word,imageUrl:i<22?'/word-bank-images/road.webp':null})));const ids=['basic-list','basic-card','basic-tracing','basic-quiz','basic-coloring','basic-fillBlank','basic-cutPaste','basic-miniBook','basic-trueFalse','alphabet','soundBoxes','targetLetters','soundSort','rhyme','wordChain','minimalPairs','syllables','pictureMatch','meaningPairs','wordSearch','scramble','wordSort','frayer','morphology','collocations','sentenceOrder','grammarChoice'];
 browser=await chromium.launch({channel:'chrome',headless:true});page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());const go=id=>page.goto('http://127.0.0.1:5387/scripts/games/focus.html?start='+encodeURIComponent('/materials/worksheet'+(id?'?activity='+id:'')));await go('');const key='classbank:worksheets:v1:teacher-a:academy-a';
 for(const id of ids){const sample=exampleWorksheet(id),ordinary=documentFromSource(id,selected,bank);delete ordinary.source;const samplePlan=prepareWorksheet(sample),ordinaryPlan=prepareWorksheet(ordinary);assert(samplePlan.ready,id+' sample');const doc=ordinaryPlan.ready?ordinary:sample;const expected=prepareWorksheet(doc);await page.evaluate(({key,doc})=>localStorage.setItem(key,JSON.stringify({current:{[doc.activityId]:doc},copies:[]})),{key,doc});await go(id);await page.locator('[data-worksheet-editor]').waitFor();await page.locator('.ws-preview-viewport .print-board').first().waitFor();await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.ws-preview-viewport img')].map(i=>i.decode()));});const studentBefore=await page.locator('.ws-preview-viewport').innerText();assert(!studentBefore.includes('undefined'),id);const count=await page.locator('.ws-preview-viewport .print-board').count();assert.equal(count,expected.pages,id+' all pages');const overflow=await page.locator('.ws-preview-viewport .print-board').evaluateAll(els=>els.map(el=>({w:el.scrollWidth-el.clientWidth,h:el.scrollHeight-el.clientHeight})));assert(overflow.every(x=>x.w<=3),id+' horizontal overflow');
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('.ws-preview-viewport').innerText(),studentBefore,id+' same print questions');await page.pdf({path:out+'/'+id+'-student.pdf',preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});await page.getByRole('button',{name:'교사용 설명·답안',exact:true}).click();await page.locator('.ws-preview-stack[data-audience=teacher]').waitFor();assert(!(await page.locator('.ws-preview-viewport').innerText()).includes('undefined'));await page.emulateMedia({media:'print'});await page.pdf({path:out+'/'+id+'-teacher.pdf',preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});checks.push({id,ordinary:{ready:ordinaryPlan.ready,used:ordinaryPlan.usedCount,pages:ordinaryPlan.pages},sample:{used:samplePlan.usedCount,pages:samplePlan.pages},printed:ordinaryPlan.ready?'ordinary25':'suitable-sample',studentPages:count,overflow});console.log('PASS',id,count);if(['basic-tracing','scramble','pictureMatch','basic-miniBook'].includes(id))await page.screenshot({path:resolve(root,'../output/worksheet-ux/'+id+'.png')});}
 assert.deepEqual(errors,[]);writeFileSync(resolve(root,'../output/worksheet-ux/print-checks.json'),JSON.stringify({passed:true,checks,errors},null,2));
}catch(e){console.error(e);if(page){console.error((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:resolve(root,'../output/worksheet-ux/print-failure.png'),fullPage:true});}process.exitCode=1;}finally{await browser?.close();await server.close();}
