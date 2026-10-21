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
fetchWordBank:async()=>['apple','banana','cat','dog','sun','fish','ball','hat'].map((word,i)=>({id:'bank'+i,word,meaning:'sample',category:'동물',level:1,image_url:'/word-bank-images/'+word+'.webp'})),
fetchPhonicsBank:async()=>['cat','hat','bat','mat','fat','rat'].map((word,i)=>({id:'ph'+i,word,meaning:'sample',step:1,rule:'short a',image_url:'/phonics-images/'+word+'.webp',pattern_marked:word})),

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
      configureServer(server) { server.middlewares.use((req,res,next)=>{if(req.url?.startsWith("/materials") && req.headers.accept?.includes("text/html"))req.url="/scripts/materials/materials.html";next();}); },
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
  server: { hmr: false, host: "127.0.0.1", port: 5199, strictPort: true },
});


let browser,page;
try {
 await server.listen();browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});page=await browser.newPage({viewport:{width:1586,height:1050}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fixture='http://127.0.0.1:5199/scripts/materials/materials.html';
 const go=async(hash='')=>{await page.goto(fixture+'?start='+encodeURIComponent('/materials'+hash));await page.locator('.materials-browser').waitFor();const tip=page.getByRole('button',{name:'알겠어요',exact:true});if(await tip.isVisible())await tip.click();await page.evaluate(()=>document.fonts.ready);};
 const nav=()=>page.locator('.materials-shortcuts');
 const active=async(id)=>page.waitForFunction(id=>document.querySelector('.materials-shortcuts [aria-current]')?.getAttribute('href')==='#materials-'+id,id);
 const visibleTitle=async(id)=>assert(await page.evaluate(id=>{const title=document.querySelector('#materials-'+id+' h2').getBoundingClientRect();const bar=document.querySelector('.materials-shortcuts').getBoundingClientRect();return title.top>=bar.bottom+8&&title.top<innerHeight;},id),'title hidden for '+id);
 const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal page overflow');
 await go();
 const keys=['words','phonics','gamecards','roleplay'];
 for(const key of keys){const count=await page.locator('#materials-'+key+' .materials-card').count();assert.equal(Number(await nav().locator(`a[href="#materials-${key}"] .materials-count`).innerText()),count);}
 await page.evaluate(async()=>{const {MATERIALS_CATALOG,materialSections}=await import('/src/lib/materialsCatalog.ts');const extended=materialSections([...MATERIALS_CATALOG,{id:'future',path:'/materials/future',icon:'print',cover:null,nameKey:'future',descKey:'future'}]);if(extended.at(-1).key!=='other'||extended.at(-1).items.length!==1)throw Error('new resource disappeared');});
 await nav().locator('a').first().focus();await page.keyboard.press('Enter');await visibleTitle('words');assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'H2');await page.evaluate(()=>scrollTo(0,0));
 assert.equal(await page.locator('.materials-card').count(),14);assert.equal(await page.locator('.materials-card a,.materials-card button').count(),0);
 for(const img of await page.locator('.materials-cover img').all())await img.scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('.materials-cover img')].every(img=>img.complete&&img.naturalWidth));await page.evaluate(()=>scrollTo(0,0));await active('words');
 await noOverflow();await page.screenshot({path:resolve(root,'../output/materials-desktop.png'),fullPage:true});await page.screenshot({path:resolve(root,'../output/materials-desktop-viewport.png')});
 const historyLength=await page.evaluate(()=>history.length);
 for(const key of keys){await nav().locator(`a[href="#materials-${key}"]`).click();await page.waitForTimeout(850);await active(key);await visibleTitle(key);assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'H2');}
 assert.equal(await page.evaluate(()=>history.length),historyLength);assert.equal(await page.locator('.materials-card').count(),14);
 await page.screenshot({path:resolve(root,'../output/materials-sticky.png')});
 await page.mouse.wheel(0,-10000);await page.waitForTimeout(850);await active('words');
 await page.evaluate(()=>scrollTo(0,scrollY+document.querySelector('#materials-phonics').getBoundingClientRect().top-parseFloat(getComputedStyle(document.querySelector('.materials-browser')).getPropertyValue('--materials-inset'))));await active('phonics');
 await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await active('roleplay');
 console.log('ok counts, all materials retained, anchor focus/history, sticky offsets, smooth click and manual/bottom scroll');
 await go('#materials-gamecards');await page.waitForTimeout(300);await active('gamecards');await visibleTitle('gamecards');await page.reload();await page.locator('.materials-browser').waitFor();await page.waitForTimeout(300);await active('gamecards');await visibleTitle('gamecards');
 await page.emulateMedia({reducedMotion:'reduce'});await nav().locator('a[href="#materials-phonics"]').click();await visibleTitle('phonics');await active('phonics');await page.emulateMedia({reducedMotion:'no-preference'});
 console.log('ok direct hash, refresh and reduced motion');
 const routes=await page.locator('.materials-card').evaluateAll(cards=>cards.map(a=>({path:a.getAttribute('href'),name:a.querySelector('h3').textContent})));
 for(const {path,name} of routes){await go();await page.locator(`.materials-card[href="${path}"]`).click();await page.waitForURL('**'+path);await page.locator('[data-app-content]').getByRole('heading',{name,exact:true}).first().waitFor();}
 console.log('ok all fourteen links open original real resource pages');
 await go();await page.locator('.materials-card[href="/materials/worksheet"]').click();await page.getByPlaceholder('새 단어',{exact:true}).fill('review');await page.getByRole('button',{name:'추가',exact:true}).click();await page.locator('.print-sheet').getByText('review',{exact:true}).first().waitFor();await page.getByRole('button',{name:/단어장에서 불러오기/}).click();await page.getByRole('button',{name:/합성 과일/}).click();assert((await page.locator('.print-sheet').innerText()).includes('apple'));
 await page.evaluate(()=>{window.__printed=0;window.print=()=>window.__printed++});await page.getByRole('button',{name:/인쇄하기/}).click();assert.equal(await page.evaluate(()=>window.__printed),1);
 for(const route of ['cvc-workbook','long-vowel-workbook']){await go();await page.locator(`.materials-card[href="/materials/${route}"]`).click();await page.getByRole('button',{name:'선택 지우기',exact:true}).click();assert(await page.getByRole('button',{name:/인쇄하기/}).isDisabled());await page.getByRole('button',{name:/^2\. /}).click();await page.evaluate(()=>{window.__printed=0;window.print=()=>window.__printed++});await page.getByRole('button',{name:/인쇄하기/}).click();assert.equal(await page.evaluate(()=>window.__printed),1);}
 console.log('ok direct input, saved words, worksheet preview/print and both workbook unit selection/print');
 await go();

 await go();await page.getByRole('button',{name:'EN',exact:true}).click();await page.getByRole('navigation',{name:'Jump to category',exact:true}).waitFor();await noOverflow();await page.getByRole('button',{name:'KO',exact:true}).click();await page.getByRole('button',{name:'아주 크게',exact:true}).click();await noOverflow();await nav().locator('a[href="#materials-phonics"]').click();await page.waitForTimeout(850);await visibleTitle('phonics');await page.screenshot({path:resolve(root,'../output/materials-large-text.png')});await page.getByRole('button',{name:'보통',exact:true}).click();
 for(const [name,width,height] of [['tablet',820,1180],['mobile',390,844]]){await page.setViewportSize({width,height});await go();for(const img of await page.locator('.materials-cover img').all())await img.scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('.materials-cover img')].every(img=>img.complete&&img.naturalWidth));await page.evaluate(()=>scrollTo(0,0));await active('words');await noOverflow();await page.screenshot({path:resolve(root,`../output/materials-${name}.png`),fullPage:true});await page.screenshot({path:resolve(root,`../output/materials-${name}-viewport.png`)});await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await active('roleplay');await nav().locator('a[href="#materials-roleplay"]').click();await page.waitForTimeout(850);await visibleTitle('roleplay');const visible=await nav().locator('[aria-current]').evaluate(link=>{const a=link.getBoundingClientRect(),b=link.parentElement.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1});assert(visible);await page.screenshot({path:resolve(root,`../output/materials-${name}-sticky.png`)});}
 await page.setViewportSize({width:390,height:844});await go();await page.evaluate(()=>document.documentElement.setAttribute('data-font-scale','xlarge'));await noOverflow();await nav().locator('a[href="#materials-gamecards"]').click();await page.waitForTimeout(850);await visibleTitle('gamecards');await page.screenshot({path:resolve(root,'../output/materials-mobile-large.png')});

 page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});page.on('pageerror',e=>errors.push(e.message));await go();
 const rail=page.locator('.materials-shortcuts-scroll');const box=await rail.boundingBox();const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width-15,y:box.y+25}]});
 for(let step=1;step<=5;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width-15-step*45,y:box.y+25}]});await page.waitForTimeout(40);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);assert((await rail.evaluate(el=>el.scrollLeft))>50);
 await nav().locator('a[href="#materials-roleplay"]').tap();await page.waitForTimeout(850);await active('roleplay');await visibleTitle('roleplay');console.log('ok mobile touch swipe and tap, keyboard anchor activation and future uncategorized resource visibility');
 assert.deepEqual(errors,[]);console.log('ok English, large text, tablet/mobile, horizontal rail active visibility and no runtime errors');
}catch(error){console.error(error);if(page){await page.screenshot({path:resolve(root,'../output/materials-failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-2200));}process.exitCode=1;}
finally{await browser?.close();await server.close();}
