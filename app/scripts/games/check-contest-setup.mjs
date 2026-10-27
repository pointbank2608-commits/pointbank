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
lists[0].items=Array.from({length:37},(_,i)=>({id:'w'+i,word:'word'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26),meaning:'뜻'+i,image_url:null}));lists[1].items=Array.from({length:12},(_,i)=>({id:'s'+i,word:'I see a '+String.fromCharCode(97+i)+' cat.',meaning:'문장 뜻'+i,image_url:null}));
window.__workspace={templates:[],writes:[],fail:false,empty:new URLSearchParams(location.search).has('empty')};
const functions={
wordListKindOf:(list)=>list.kind==='sentence'?'sentence':'word',
updateWordListItems:async(id,items)=>{if(window.__workspace.fail)throw new Error('synthetic word update failure'); const list=lists.find(row=>row.id===id);if(list)list.items=items;},
fetchClasses:async()=>classes,fetchStudentsOfClass:async()=>students,fetchStudentsOfAcademy:async()=>students,
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
const auth = `const value={academy:{id:'academy-a',features:{group:true},plan:'paid',deletion_requested_at:null,deletion_scheduled_at:null},profile:{id:'teacher-a'},isStaff:true,isAdmin:false,hasFullAccess:true,isPaid:true,session:{user:{id:'teacher-a'}},trial:{active:false,inTrial:false,daysLeft:7},pointUnit:'별'};export const useAuth=()=>value;export const AuthProvider=({children})=>children;`;
const toast = `const run=async(fn)=>{try{await fn();return true}catch(e){console.error(e);return false}};const value={notify:()=>{},run};export const useToast=()=>value;export const ToastProvider=({children})=>children;`;
const server = await createServer({cacheDir:'node_modules/.vite/qa-check-contest-setup',
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
          return "const query={select(){return this},eq(){return this},is(){return this},gt(){return this},order(){return this},limit(){return this},then(fn){return Promise.resolve({data:[],error:null}).then(fn)}};export const supabase={from:()=>query,rpc:async(name)=>({data:name==='my_deletion_request'?null:[],error:null}),channel:()=>({on(){return this},subscribe(){return this},unsubscribe(){}})};";
      },
    },
  ],
  server: { hmr: false, host: "127.0.0.1", port: 5301, strictPort: true },
});

let browser, page;
try {
 await server.listen(); browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 page=await context.newPage(); page.setDefaultTimeout(12000); const errors=[]; page.on('pageerror',e=>errors.push(e.message)); await page.route('https://**/*',r=>r.abort());
 await page.goto('http://127.0.0.1:5301/scripts/games/focus.html?start=/games/quizshow');
 const setup=page.getByRole('region',{name:'휴대폰 참여 보카 대회 만들기'});
 await setup.getByRole('button',{name:'저장한 게임 불러오기',exact:true}).click();
 await setup.getByText('아직 저장한 대회가 없어요.',{exact:false}).waitFor();
 await setup.getByRole('combobox').selectOption('words');
 await setup.getByRole('button',{name:'다음',exact:true}).click();
 await setup.getByRole('button',{name:'뜻 고르기',exact:true}).click();
 assert.equal(await setup.getByRole('combobox').inputValue(),'3');
 for (const label of ['O·X 퀴즈','철자 쓰기','스피드 부저']) {
  await setup.getByRole('button',{name:label,exact:true}).click();
  assert.equal(await setup.getByRole('combobox').inputValue(),'3');
  await setup.getByRole('combobox').selectOption('-1');
 }
 await setup.getByRole('button',{name:'뜻 고르기',exact:true}).click();
 await setup.getByRole('combobox').selectOption('20');
 await setup.getByRole('spinbutton').first().fill('45');
 await setup.getByRole('button',{name:'이전',exact:true}).click();
 assert.equal(await setup.getByRole('combobox').inputValue(),'words');
 await setup.getByRole('button',{name:'다음',exact:true}).click();
 assert.equal(await setup.getByRole('combobox').inputValue(),'20');
 await page.screenshot({path:resolve(root,'../output/contest-setup-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await setup.scrollIntoViewIfNeeded(); await page.screenshot({path:resolve(root,'../output/contest-setup-mobile.png')});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await setup.getByRole('button',{name:'다음',exact:true}).click();
 await page.evaluate(()=>window.__workspace.fail=true);
 await setup.getByRole('button',{name:'다음 · 대회 저장',exact:true}).click();
 await setup.getByRole('alert').waitFor();
 await page.evaluate(()=>window.__workspace.fail=false);
 await setup.getByRole('button',{name:'다음 · 대회 저장',exact:true}).click();
 await setup.waitFor({state:'hidden'});
 const saved=await page.evaluate(()=>window.__workspace.writes.at(-1));
 assert.equal(saved.config.liveQuestions.length,131);
 assert.equal(saved.config.liveQuestions.filter(q=>q.roundType==='choice').length,20);
 assert(saved.config.liveQuestions.filter(q=>q.roundType==='choice').every(q=>q.seconds===45));
 assert.equal(new Set(saved.config.liveQuestions.filter(q=>q.roundType==='text').map(q=>q.answer)).size,37);
 assert.equal(new Set(saved.config.liveQuestions.filter(q=>q.roundType==='buzzer').map(q=>q.answer)).size,37);
 assert.equal(saved.config.classroomSource.cards.length,37);
 await page.locator('[data-game-preparation] > button').first().click();
 await setup.getByRole('button',{name:'문장모음',exact:true}).click();
 await setup.getByRole('combobox').selectOption('sentences');
 await setup.getByRole('button',{name:'다음',exact:true}).click();
 assert.equal(await setup.getByRole('checkbox',{name:'글자 섞기',exact:true}).isDisabled(),true);
 await setup.getByRole('button',{name:'다음',exact:true}).click();
 await setup.getByRole('button',{name:'다음 · 대회 저장',exact:true}).click();
 await setup.waitFor({state:'hidden'});
 const sentence=await page.evaluate(()=>window.__workspace.writes.at(-1));
 assert.equal(sentence.config.liveQuestions.length,12);
 assert.equal(sentence.config.classroomSource.kind,'sentence');
 await page.locator('[data-game-preparation] > button').first().click();
 await setup.getByRole('button',{name:'저장한 게임 불러오기',exact:true}).click();
 await setup.getByRole('button',{name:new RegExp(saved.name)}).click();
 await setup.waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>window.__workspace.writes.length),2,'loading must not create a duplicate');
 await page.getByText('문제 131개',{exact:false}).first().waitFor();
 // Pure generator checks, including legacy numeric calls and partial media availability.
 const logic=await page.evaluate(async()=>{
  const {buildContestQuestions,contestRoundNames,DEFAULT_CONTEST_ROUNDS}=await import('/src/lib/liveQuiz.ts');
  const {default:i18n}=await import('/src/i18n/index.ts');
  const cards=Array.from({length:81},(_,i)=>({id:'x'+i,word:'target'+String.fromCharCode(97+Math.floor(i/26))+String.fromCharCode(97+i%26),meaning:'뜻'+i,imageUrl:i<13?'/a.webp':null}));
  const names=contestRoundNames(i18n.t.bind(i18n));
  return {defaultsCount:buildContestQuestions(cards,names).length,all:buildContestQuestions(cards,names,DEFAULT_CONTEST_ROUNDS.map(r=>({...r,count:-1}))).length,legacy:buildContestQuestions(cards,names,5).length,picture:buildContestQuestions(cards,names,[{type:'picture',on:true,count:-1}]).length,defaults:DEFAULT_CONTEST_ROUNDS};
 });
 assert.equal(logic.defaultsCount,12); assert.equal(logic.all,324); assert.equal(logic.legacy,20); assert.equal(logic.picture,13); assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({passed:true,wordEntries:37,questions:131,sentenceEntries:12,sentenceQuestions:12,largeListQuestions:324,legacyQuestions:20,errors}));
} catch(error) { console.error(await page?.locator('body').innerText()); await page?.screenshot({path:resolve(root,'../output/contest-setup-failure.png'),fullPage:true}); throw error; } finally { await browser?.close(); await server.close(); }
