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
import { ORIGINAL_VERBS } from '/src/lib/elementary800Workbook.ts';
import { ELEMENTARY800_VERB_CONTINUATION } from '/src/data/elementary800VerbContinuation.ts';
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
fetchWordBank:async()=>{if(new URLSearchParams(location.search).has('fail800'))throw Error('synthetic load failure');return structuredClone(ELEMENTARY800_VERB_CONTINUATION).concat([{id:'apple',word:'apple',meaning:'사과',part_of_speech:'명사',sense_number:1,level:1,example_sentence:'I eat an apple.',image_url:'/word-bank-images/apple.webp'}]).concat(ORIGINAL_VERBS.flat().map(word=>({id:word,word,meaning:'원본 검증 뜻',part_of_speech:'동사',sense_number:1,level:1,image_url:null,example_sentence:'I '+word+'.'})));},
fetchPhonicsBank:async()=>['cat','hat','bat','mat','fat','rat'].map((word,i)=>({id:'ph'+i,word,meaning:'sample',step:1,rule:'short a',image_url:'/phonics-images/'+word+'.webp',pattern_marked:word})),

fetchMyStudentRow:async()=>({class_id:'class-a'}),
wordListKindOf:(list)=>list.kind==='sentence'?'sentence':'word',
updateWordListItems:async(id,items)=>{if(window.__workspace.fail)throw new Error('synthetic word update failure'); const list=lists.find(row=>row.id===id);if(list)list.items=items;},
fetchClasses:async()=>classes,fetchStudentsOfClass:async()=>students,fetchStudentsOfAcademy:async()=>students,
createWordList:async(p)=>{window.__workspace.saveAttempts=(window.__workspace.saveAttempts||0)+1;if(window.__workspace.failWordAt===window.__workspace.saveAttempts)throw new Error('partial save failure');if(window.__workspace.fail)throw new Error('synthetic save failure'); const row={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,kind:p.kind,items:p.items,updated_at:'now'};(window.__workspace.wordWrites||=[]).push(row);lists.push(row);return row;},
fetchAllWordLists:async()=>{if(window.__workspace.fail)throw new Error('synthetic load failure');return window.__workspace.empty?[]:structuredClone(lists)},fetchAllCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
fetchCurriculumLessons:async()=>structuredClone(window.__workspace.lessons||[]),
fetchCurriculumLessonById:async(id)=>(window.__workspace.lessons||[]).find(x=>x.id===id),
createCurriculumLesson:async(p)=>{const l={id:crypto.randomUUID(),academy_id:p.academyId,class_id:p.classId,name:p.name,playlist:p.playlist,updated_at:'now'};(window.__workspace.lessons||=[]).push(l);return l;},
appendActivityToLesson:async(l,s)=>{l.playlist.push(s)},
fetchWordLists:async(_a,_c,k)=>structuredClone((!k||k==='all')?lists:lists.filter(x=>x.kind===k)),
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
      configureServer(server) { server.middlewares.use((req,res,next)=>{if(req.url?.startsWith("/materials") && req.headers.accept?.includes("text/html"))req.url="/scripts/materials/elementary800.html";next();}); },
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
  server: { hmr: false, host: "127.0.0.1", port: 5257, strictPort: true },
});


let browser,page;
try{
 await server.listen();const lib=await server.ssrLoadModule('/src/lib/elementary800Workbook.ts');
 const {ELEMENTARY800,ORIGINAL_VERBS,buildElementaryBooklets,elementaryCoverage}=lib;
 assert.equal(new Set(ELEMENTARY800.values()).size,800);assert.equal(ORIGINAL_VERBS.flat().length,100);assert.equal(new Set(ORIGINAL_VERBS.flat()).size,100);
 const row=(word,pos='동사',level=1,sense=1)=>({id:word+'-'+sense,word,part_of_speech:pos,level,sense_number:sense,meaning:word,sort_order:999});
 const input=[row('eat'),row('act','동사',2),row('drink'),row('run'),row('not-a-member'),row('apple','명사'),row('apple','명사',1,2)];const snapshot=JSON.stringify(input);const books=buildElementaryBooklets(input);
 assert.equal(JSON.stringify(input),snapshot);assert.equal(books[0].level,5);assert(!books.flatMap(b=>b.entries).some(w=>w.word==='run'||w.word==='not-a-member'));
 assert.deepEqual(books[0].entries.map(w=>w.word),['drink','eat','act']);assert.equal(books.find(b=>b.pos==='noun').entries.length,1);assert.equal(elementaryCoverage(input),5);
 assert.equal(buildElementaryBooklets([{...row('brush'),moe800_no:null}]).length,0,'exclude extension senses outside the marked list');
 assert.equal(buildElementaryBooklets([{...row('eat'),moe800_no:ELEMENTARY800.get('eat')}]).length,1);
 const full=[...ELEMENTARY800.keys()].map((word,i)=>row(word,['명사','형용사','부사','전치사','동사'][i%5],i%4+1));
 const fullBooks=buildElementaryBooklets(full);
 assert(fullBooks.every(b=>b.entries.length<=25));
 const produced=new Set(fullBooks.flatMap(b=>b.entries.map(w=>w.word)));
 for(const w of full)assert(produced.has(w.word)||(w.part_of_speech==='동사'&&ORIGINAL_VERBS.flat().includes(w.word)));
 console.log('ok canonical 800 numbers, original 100 order, original exclusion, stable difficulty/curriculum sort, no mutations');
 const reuse=await server.ssrLoadModule('/src/lib/elementary800Sources.ts');
 const cards=reuse.bookletCards([{id:'noun-1',pos:'noun',level:1,entries:[{...row('apple','명사'),image_url:'/word-bank-images/apple.webp',example_sentence:'I eat an apple.',category:'fruit'}]}]);
 const items=reuse.workbookListItems(cards);const own={id:'own',academy_id:'academy-a',kind:'word',items};
 assert.equal(reuse.matchingWorkbookList([{...own,academy_id:'other-academy'}],'academy-a',cards),undefined);
 assert.equal(reuse.matchingWorkbookList([{...own,kind:'sentence'}],'academy-a',cards),undefined);
 assert.equal(reuse.matchingWorkbookList([{...own,items:[{...items[0],meaning:'edited'}]}],'academy-a',cards),undefined);
 assert.equal(reuse.matchingWorkbookList([own],'academy-a',cards).id,'own');
 assert.equal(items[0].example,'I eat an apple.');

 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:5257/scripts/materials/elementary800.html?start=';
 await page.goto(url+encodeURIComponent('/materials'));await page.locator('#materials-elementary800').waitFor();assert.equal(await page.locator('#materials-elementary800 .materials-card').count(),2);
 await page.locator('#materials-elementary800 .materials-card').first().click();await page.getByRole('heading',{name:'초등 800단어 단어장',exact:true}).waitFor();
 const pdf=await page.request.get('http://127.0.0.1:5257/workbooks/elementary800/verbs-level1-4.pdf');assert.equal(pdf.status(),200);assert((await pdf.body()).subarray(0,4).toString()==='%PDF');
 await page.getByRole('radio',{name:'Level 3',exact:true}).check();assert((await page.getByRole('link',{name:'PDF 열기 · 인쇄 ↗',exact:true}).getAttribute('href')).endsWith('verbs-level3.pdf'));
 await page.screenshot({path:resolve(root,'../output/elementary800-original.png')});
 for(const file of ['verbs-level5.pdf','verbs-level6.pdf','verbs-level7.pdf','verbs-level5-7.pdf','verbs-level1-7.pdf'])assert.equal((await page.request.head('http://127.0.0.1:5257/workbooks/elementary800/'+file)).status(),200);
 await page.getByRole('link',{name:'동사편 전체 Level 1–7 내려받기',exact:true}).waitFor();
 await page.getByRole('link',{name:'이어서 만들기 · 품사별 교재',exact:true}).click();await page.getByRole('combobox',{name:'품사 선택',exact:true}).waitFor();
 await page.getByRole('checkbox',{name:/Level 5/}).check();assert.equal(await page.locator('.e800-write-row').count(),25);assert.equal(await page.locator('[data-sheet-kind="writing"]').count(),7);assert.equal(await page.locator('[data-sheet-kind="cards"]').count(),2);
 await page.locator('.e800-pages').evaluate(async el=>{await document.fonts.ready;await Promise.all([...el.querySelectorAll('img')].map(x=>x.decode()));});
 await page.screenshot({path:resolve(root,'../output/elementary800-builder.png')});
 await page.evaluate(()=>{window.__printCalls=0;window.print=()=>{window.__printCalls++}});
 await page.getByRole('button',{name:'선택한 교재 인쇄 · PDF 저장',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.__printCalls),1);
 const overflow=await page.locator('.e800-sheet').evaluateAll(nodes=>nodes.filter(x=>x.scrollHeight>x.clientHeight+2).length);assert.equal(overflow,0,'A4 sheet content overflow');
 await page.emulateMedia({media:'print'});await page.pdf({path:resolve(root,'../output/pdf/elementary800-continuation-qa.pdf'),preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
 await page.getByRole('checkbox',{name:'게임 안내 포함',exact:true}).check();await page.getByRole('combobox',{name:'카드 반복 인쇄',exact:true}).selectOption('4');assert.equal(await page.locator('[data-sheet-kind="cards"]').count(),8);assert.equal(await page.locator('[data-sheet-kind="guide"]').count(),1);
 await page.getByRole('combobox',{name:'품사 선택',exact:true}).selectOption('noun');assert.equal(await page.locator('.e800-sheet').count(),0);await page.getByRole('checkbox',{name:/Level 1/}).check();assert.equal(await page.locator('.e800-write-row').count(),1);
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:resolve(root,'../output/elementary800-mobile.png')});
 await page.evaluate(async()=>{const m=await import('/src/i18n/index.ts');await m.default.changeLanguage('en')});await page.getByRole('button',{name:'Print selection · Save PDF',exact:true}).waitFor();

 // Real components + synthetic backend: no production writes.
 await page.goto(url+encodeURIComponent('/materials/elementary-800?tab=workbook&pos=verb&levels=verb-5,verb-6'));
 await page.getByRole('button',{name:'이 단어로 게임하기',exact:true}).waitFor();
 const openSave=()=>page.getByRole('button',{name:'단어장으로 저장',exact:true}).click();
 const confirm=()=>page.getByRole('button',{name:'저장 · 기존 단어장 확인',exact:true}).click();
 await openSave();assert.equal(await page.getByRole('radio',{name:'레벨별 단어장으로 저장 (기본)',exact:true}).isChecked(),true);
 await page.evaluate(()=>{window.__workspace.failWordAt=2;});await confirm();await page.getByRole('alert').filter({hasText:'저장하지 못한 자료'}).waitFor();
 assert.equal(await page.evaluate(()=>window.__workspace.wordWrites.length),1);
 await confirm();await page.getByRole('dialog').getByText('초등 800단어 · 동사 Level 6 · 25개 단어',{exact:true}).waitFor();
 let saved=await page.evaluate(()=>window.__workspace.wordWrites);assert.equal(saved.length,2);
 const expected=await page.evaluate(async()=>{const api=await import('/src/lib/api.ts');const book=await import('/src/lib/elementary800Workbook.ts');return book.buildElementaryBooklets(book.workbookBankWithVerbContinuation(await api.fetchWordBank())).filter(b=>['verb-5','verb-6'].includes(b.id));});
 assert.deepEqual(saved.map(row=>row.items.map(w=>[w.word,w.meaning,w.image_url,w.example])),expected.map(book=>book.entries.map(w=>[w.word,w.meaning,w.image_url,w.example_sentence])));
 await confirm();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__workspace.wordWrites.length),2,'repeated save reuses exact lists');
 await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
 await openSave();await page.getByRole('radio',{name:'선택한 레벨을 한 단어장으로 합치기',exact:true}).check();await confirm();
 await page.getByRole('dialog').getByText('초등 800단어 · 동사 Level 5, 6 · 50개 단어',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.__workspace.wordWrites.length),3);
 // Reopen saved data in the existing word-list screen.
 await page.getByRole('dialog').getByRole('link',{name:'내 단어장 열기 →',exact:true}).click();
 await page.waitForURL('**/wordlists');await page.getByText('초등 800단어 · 동사 Level 5, 6',{exact:true}).waitFor();
 await page.goBack();await page.getByRole('button',{name:'이 단어로 게임하기',exact:true}).waitFor();
 await page.setViewportSize({width:1440,height:1000});await page.locator('[data-e800-actions]').evaluate(el=>el.scrollIntoView({block:'center'}));
 await page.screenshot({path:resolve(root,'../output/elementary800-reuse-desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.locator('[data-e800-actions]').evaluate(el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:resolve(root,'../output/elementary800-reuse-mobile.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:1440,height:1000});
 // Quick launch must not create a word list, game template, lesson or class.
 await page.getByRole('button',{name:'이 단어로 게임하기',exact:true}).click();await page.locator('a[href="/games/wheel"]').first().click();
 await page.getByRole('heading',{name:'내용을 준비해 주세요',exact:true}).waitFor();assert.equal(await page.locator('dialog fieldset input').count()>=50,true);
 await page.getByRole('button',{name:'다음',exact:true}).click();await page.getByRole('button',{name:'다음',exact:true}).click();await page.getByRole('button',{name:'▶ 게임 시작',exact:true}).click();await page.locator('[data-play-mode=play]').waitFor();
 const source=await page.evaluate(()=>history.state.usr.quickSource);
 assert.equal(source.ownerId,'teacher-a');assert.equal(source.academyId,'academy-a');assert.equal(source.cards.length,50);
 assert.deepEqual(source.cards.map(w=>w.word),expected.flatMap(b=>b.entries.map(w=>w.word)));
 assert.equal(await page.evaluate(()=>window.__workspace.wordWrites.length),3);assert.equal(await page.evaluate(()=>window.__workspace.templates.length),0);
 console.log('ok per-level/merged save, exact order and metadata, partial-failure retry, duplicate reuse, unsaved 50-word game launch');
 // Existing/new lessons are created only after explicit confirmation.
 await page.goto(url+encodeURIComponent('/materials/elementary-800?tab=workbook&pos=verb&levels=verb-5'));
 await page.evaluate(()=>{window.__workspace.lessons=[{id:'existing',academy_id:'academy-a',class_id:null,name:'기존 수업',playlist:[]}];});
 await page.getByRole('button',{name:'수업에 추가',exact:true}).click();assert.equal(await page.evaluate(()=>window.__workspace.templates.length),0);
 await page.getByRole('dialog').getByRole('combobox').selectOption('existing');await page.getByRole('dialog').getByRole('button',{name:'수업에 추가',exact:true}).click();
 await page.waitForURL('**/curriculum');
 assert.equal(await page.evaluate(()=>window.__workspace.lessons.length),1);assert.equal(await page.evaluate(()=>window.__workspace.lessons[0].playlist.length),1);
 assert.deepEqual(await page.evaluate(()=>window.__workspace.templates[0].config.classroomSource.cards.map(w=>w.word)),expected[0].entries.map(w=>w.word));
 await page.goto(url+encodeURIComponent('/materials/elementary-800?tab=workbook&pos=noun&levels=noun-1'));
 await page.getByRole('button',{name:'수업에 추가',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.__workspace.lessons?.length||0),0);
 await page.getByRole('dialog').getByRole('combobox').selectOption('new');await page.getByRole('dialog').getByRole('button',{name:'수업에 추가',exact:true}).click();await page.waitForURL('**/curriculum');
 assert.equal(await page.evaluate(()=>window.__workspace.lessons.length),1);
 // Original levels retain their 25-word PDF order.
 await page.goto(url+encodeURIComponent('/materials/elementary-800?tab=original'));
 await page.getByRole('radio',{name:'Level 2',exact:true}).check();await page.getByRole('button',{name:'단어장으로 저장',exact:true}).click();await confirm();
 await page.getByRole('dialog').getByText('초등 800단어 · 동사 Level 2 · 25개 단어',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.__workspace.wordWrites[0].items.map(w=>w.word)),ORIGINAL_VERBS[1]);
 await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:1440,height:1000});
 console.log('ok existing/new lessons and original PDF word order, mobile layout');
 await page.goto(url+encodeURIComponent('/materials/elementary-800?tab=workbook&fail800=1'));await page.getByRole('button',{name:/Retry|다시 불러오기/}).waitFor();
 await page.goto(url+encodeURIComponent('/materials/elementary-800?tab=original&fail800=1'));await page.getByRole('alert').filter({hasText:'선택한 원본 레벨의 단어 정보를'}).waitFor();assert.equal(await page.getByRole('button',{name:'단어장으로 저장',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS original PDFs, catalog route, verb continuation, all selection/reset, copies, A4 PDF, mobile, English, load error');
}catch(e){console.error(e);if(page)await page.screenshot({path:resolve(root,'../output/elementary800-failure.png'),fullPage:true});process.exitCode=1;}
finally{await browser?.close();await server.close();}
