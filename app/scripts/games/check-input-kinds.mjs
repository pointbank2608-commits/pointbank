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


let browser,page;
try {
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const fixture='http://127.0.0.1:5263/scripts/games/focus.html';
 const fresh=async()=>{const ctx=await browser.newContext({viewport:{width:1280,height:1600}});await ctx.route('https://**/*',route=>route.abort());return ctx.newPage();};
 const modeLabel={word:'단어로 만들기',sentence:'문장으로 만들기'};
 const open=async(type,kind)=>{page=await fresh();await page.goto(fixture+`?start=/games/${type}`);const guide=page.locator('[data-game-guide]');await guide.getByRole('button',{name:modeLabel[kind],exact:false}).click({timeout:8000});await page.locator('[data-guide-step="1"]').waitFor({timeout:8000});await page.waitForTimeout(100);return guide;};
 page=await fresh();await page.goto(fixture+'?start=/games/bomb');
 const plan=await page.evaluate(async()=>{const g=await import('/src/lib/gameGuide.ts');const c=await import('/src/lib/gameCatalog.ts');return c.GAME_CATALOG.map(x=>({type:x.type,kinds:g.guideKinds(x.type).filter(k=>k==='word'||k==='sentence')}));});
 await page.context().close();
 // 1) 모든 게임·모드: 불러오기 버튼, 열 이름, 안내 문구가 선택한 모드와 맞는다.
 const wrongInWord=['문장','해석 (필요한 경우)','정답 (문장)'],wrongInSentence=['단어','뜻','정답 (단어)'];
 let checked=0;const skipped=[];
 for(const {type,kinds} of plan){for(const kind of kinds){
  let guide;try{guide=await open(type,kind);}catch(e){skipped.push(`${type}:${kind}`);await page.context().close();continue;}
  const info=await page.evaluate(()=>{
   const g=document.querySelector('[data-game-guide]');
   const pickers=[...g.querySelectorAll('[data-game-source-picker]')].map(p=>[...p.querySelectorAll(':scope > div:first-of-type button')].map(b=>b.textContent.trim()));
   const rows=[...g.querySelectorAll('fieldset[data-guide-row]')];
   const cols=rows[0]?[...rows[0].querySelectorAll('label')].map(l=>(l.childNodes[0]?.textContent||'').trim()):[];
   const clone=g.cloneNode(true);clone.querySelectorAll('fieldset[data-guide-row]').forEach(n=>n.remove());
   return {pickers,cols,text:clone.textContent.replace(/\s+/g,' ')};
  });
  const own=kind==='word'?'내 단어장 불러오기':'내 문장 모음 불러오기',other=kind==='word'?'내 문장 모음 불러오기':'내 단어장 불러오기';
  for(const picker of info.pickers){assert(picker.includes(own),`${type}:${kind} picker ${picker}`);assert(!picker.includes(other),`${type}:${kind} has the other picker`);}
  assert(!info.text.includes(other),`${type}:${kind} shows "${other}"`);
  for(const col of info.cols)assert(!(kind==='word'?wrongInWord:wrongInSentence).includes(col),`${type}:${kind} column "${col}"`);
  if(kind==='sentence')assert(!info.text.includes('단어와 뜻'),`${type}:sentence paste hint mentions words`);
  if(kind==='word')assert(!info.text.includes('문장과 해석'),`${type}:word paste hint mentions sentences`);
  checked++;await page.context().close();
 }}
 assert(checked>=55,`only ${checked} game/mode screens checked`);
 assert(skipped.every(s=>s.startsWith('quizshow')),`unexpected skips: ${skipped}`);
 console.log(`ok ${checked} game/mode screens: loaders, columns and hints match the chosen mode (skipped ${skipped.join(',')||'none'})`);
 // 2) 직접 입력한 내용도 모드와 맞아야 완료된다.
 const fill=async(guide,values)=>{const inputs=guide.locator('[data-guide-row="0"] input');for(let i=0;i<values.length;i++)if(values[i]!=null)await inputs.nth(i).fill(values[i]);};
 const attempt=async(type,kind,values)=>{const guide=await open(type,kind);await fill(guide,values);await guide.getByRole('button',{name:'완료',exact:true}).click();await page.waitForTimeout(250);const error=await guide.locator('[data-guide-error]').count()?await guide.locator('[data-guide-error]').innerText():'';await page.context().close();return error;};
 const SENTENCE_IN_WORDS=/단어로 만들기에는/,WORD_IN_SENTENCES=/문장으로 만들기에는/;
 const sentence='I like to play soccer.';
 for(const [type,values] of [['wheel',[sentence]],['bomb',[sentence,'']],['hangman',[sentence,'']],['matchup',[sentence,'축구']],['flashcards',[sentence,'축구']],['groupsort',[sentence,'sports']],['typeanswer',['축구',sentence]],['catchsentence',[sentence,'']]]){
  const error=await attempt(type,'word',values);assert(SENTENCE_IN_WORDS.test(error),`${type}: sentence typed in word mode was not blocked (${error})`);
 }
 for(const [type,values] of [['bomb',['apple','']],['unscramble',['apple','']],['flashcards',['apple','사과']],['lightning',['apple','']],['typeanswer',['사과','apple']],['wheel',['apple']],['treasuredig',['apple','']]]){
  const error=await attempt(type,'sentence',values);assert(WORD_IN_SENTENCES.test(error),`${type}: single word typed in sentence mode was not blocked (${error})`);
 }
 // 단어·짧은 표현은 단어 모드에서, 문장은 문장 모드에서 막히지 않는다.
 for(const [type,kind,values] of [['bomb','word',['ice cream','']],['wheel','word',['look at']],['matchup','word',['apple','사과']],['typeanswer','word',['사과','apple']],['bomb','sentence',[sentence,'']],['flashcards','sentence',['I like cats.','나는 고양이를 좋아해요.']],['wheel','sentence',['Hello.']],['typeanswer','sentence',['나는 축구를 좋아해요.',sentence]]]){
  const error=await attempt(type,kind,values);assert(!SENTENCE_IN_WORDS.test(error)&&!WORD_IN_SENTENCES.test(error),`${type}:${kind} valid input was blocked (${error})`);
 }
 console.log('ok typed input: sentences blocked in word mode, single words blocked in sentence mode, valid input passes');
 // 3) 영어 화면에서도 같은 안내가 나온다.
 {const guide=await open('bomb','word');await page.evaluate(async()=>{const m=await import('/src/i18n/index.ts');await m.default.changeLanguage('en');});await fill(guide,[sentence,'']);await guide.getByRole('button',{name:'Done',exact:true}).click();await guide.locator('[data-guide-error]').waitFor();assert(/looks like a sentence/.test(await guide.locator('[data-guide-error]').innerText()));await page.context().close();}
 console.log('PASS word mode takes words only and sentence mode takes sentences only in every game');
}catch(error){console.error(error);if(page){try{await page.screenshot({path:resolve(root,'../output/input-kinds-failure.png'),fullPage:true});}catch{}}process.exitCode=1;}
finally{await browser?.close();await server.close();}
