import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {createServer} from 'vite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const out='../output/phonics-print-course',pdfOut='../tmp/pdfs/worksheet-studio';await mkdir(out,{recursive:true});await mkdir(pdfOut,{recursive:true});
const env=await readFile('.env.local','utf8'),ref=env.match(/VITE_SUPABASE_URL=https:\/\/([^.]+)/)[1];
const uid='00000000-0000-4000-8000-000000000001',aid='00000000-0000-4000-8000-0000000000aa';
const exp=Math.floor(Date.now()/1000)+86400,b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const user={id:uid,aud:'authenticated',role:'authenticated',email:'worksheet-qa@example.test',app_metadata:{},user_metadata:{}};
const session={access_token:`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:uid,role:'authenticated',exp,aud:'authenticated'})}.test-only`,refresh_token:'test-only',expires_at:exp,expires_in:86400,token_type:'bearer',user};
const profile={id:uid,academy_id:aid,role:'owner',display_name:'Worksheet QA'},academy={id:aid,name:'Worksheet QA',point_unit:'별',plan:'paid',plan_status:'active',deletion_requested_at:null,features:{group:true,solo:true,homework:true}};
const server=await createServer({server:{host:'127.0.0.1',port:Number(process.env.PHONICS_QA_PORT||5250),strictPort:true},logLevel:'error'});await server.listen();
const {WORKSHEET_ACTIVITIES,WORKSHEET_BASIC_ACTIVITIES}=await server.ssrLoadModule('/src/lib/worksheetActivityCatalog.ts');
const {exampleWorksheet}=await server.ssrLoadModule('/src/lib/worksheetActivitySamples.ts');
const {studioKey}=await server.ssrLoadModule('/src/lib/worksheetStudio.ts');
const {curriculumEntries}=await server.ssrLoadModule('/src/data/phonicsCurriculum.ts');
const common=curriculumEntries();
const getWord=word=>common.find(e=>e.word===word&&e.step>=2)||common.find(e=>e.word===word);
const list={id:'worksheet-word-list',name:'우리 반 동물 단어',kind:'word',class_id:null,academy_id:aid,updated_at:'2026-10-25',items:['frog','duck','fish','pig'].map((word,i)=>{const e=getWord(word);return {id:'source-'+i,word,meaning:e.meaning,image_url:e.image_url,category:i<2?'A':'B',patternMarked:e.pattern_marked};})};
const sentenceList={...list,id:'worksheet-sentence-list',name:'우리 반 문장',kind:'sentence',items:[{id:'line1',word:'Our class can help.',meaning:'우리 반은 도울 수 있어요.',image_url:null,category:null}]};
let mediaRows=[];const writes=[];
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
await context.addInitScript(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('classbank.lang','ko');localStorage.setItem('classbank.printWatermark','off');},{key:`sb-${ref}-auth-token`,session});
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname,headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});if(!['GET','HEAD'].includes(req.method())&&!path.includes('/auth/')&&!path.includes('/rpc/'))writes.push(path);
 const single=(req.headers().accept||'').includes('vnd.pgrst.object');let data=single?{}:[];
 if(path.includes('/auth/v1/user'))data=user;else if(path.includes('/auth/v1/'))data=session;
 else if(path.endsWith('/profiles'))data=single?profile:[profile];else if(path.endsWith('/academies'))data=single?academy:[academy];
 else if(path.endsWith('/classes'))data=[{id:'class-qa',academy_id:aid,name:'검증 반'}];
 else if(path.endsWith('/word_lists'))data=[list,sentenceList];
 else if(path.endsWith('/phonics_bank'))data=mediaRows;
 else if(path.endsWith('/word_bank'))data=list.items.map((w,i)=>({...w,example_sentence:`I can see a ${w.word}.`,part_of_speech:'명사',sense_number:1,sort_order:i}));
 else if(path.endsWith('/rpc/my_deletion_request'))data=null;
 return route.fulfill({status:200,headers,json:data});
});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const root=process.env.PHONICS_QA_URL||('http://127.0.0.1:'+(process.env.PHONICS_QA_PORT||5250));
const report={passed:false,activities:[],errors},pdf=process.argv.includes('--pdf'),smoke=process.argv.includes('--smoke');
async function open(id){await page.goto(root+'/materials/worksheet?activity='+id);await page.locator(`[data-worksheet-editor="${id}"]`).waitFor();await page.getByRole('button',{name:'학생용 인쇄',exact:true}).waitFor();}
async function assertReady(id){await page.waitForFunction(()=>{const buttons=[...document.querySelectorAll('button')],print=buttons.find(e=>e.textContent==='학생용 인쇄'),refresh=buttons.find(e=>e.textContent==='내 자료 새로 불러오기');return print&&!print.disabled&&refresh&&!refresh.disabled&&!document.querySelector('.ws-validation');});assert.equal(await page.locator('.ws-validation').count(),0,id+' valid example');}
const production=process.argv.includes('--production');
const result={passed:false,production,errors,missing:[],checks:[]};
try{
 const {unitsForStep}=await server.ssrLoadModule('/src/data/phonicsCurriculum.ts');
 const {buildPhonicsWorkbook,workbookPrintable}=await server.ssrLoadModule('/src/data/phonicsWorkbook.ts');
 const {teachingUnits}=await server.ssrLoadModule('/src/data/phonicsTeachingCourse.ts');
 const units=buildPhonicsWorkbook(common,1),ready=units.filter(workbookPrintable);
 assert.equal(units.length,26);assert(units.every(u=>u.words.length===3));
 assert.deepEqual(units.map(u=>u.id),unitsForStep(1).map(u=>u.id));
 assert.deepEqual(units[23].words,['box','fox','six']);assert(units[23].words.every(w=>JSON.stringify(units[23].targets[w].red)==='[2]'));
 assert.deepEqual(units[16].targets.queen.red,[0]);
 assert.equal(unitsForStep(2).length,24);assert.deepEqual(unitsForStep(2)[0].entries.map(e=>e.word),['dad','bad','sad']);
 const cvcTeaching=teachingUnits(common).find(u=>u.step===2);assert.deepEqual(cvcTeaching.entries.map(e=>e.word),['dad','bad','sad','bag','tag','wag','jam','ram','ham']);
 assert.equal(teachingUnits(common).find(u=>u.id==='stage1-abc').entries.length,9);
 assert.equal(unitsForStep(4).length,48);assert.equal(unitsForStep(5).length,32);assert(!unitsForStep(4).some(u=>u.ruleId==='lk'));
 result.missing=units.flatMap(u=>u.issues.map(i=>({unit:u.family,word:i.word,type:i.type})));result.ready=ready.length;
 await page.goto(root+'/materials/phonics-stage-1');const picker=page.locator('[data-unit-picker]');await picker.locator('input').last().waitFor();
 await page.waitForFunction(n=>document.querySelectorAll('[data-unit-picker] input:enabled').length===n,ready.length);
 assert.equal(await picker.locator('input').count(),26);assert.equal(await picker.locator('input:disabled').count(),26-ready.length);
 assert(!/1차시|2차시|슬라이드|8쪽|기본 4쪽/.test(await page.locator('[data-app-content]').innerText()));
 const panel=page.locator('[data-unit-picker-panel]');
 await page.waitForFunction(n=>[...document.querySelectorAll('p')].some(p=>p.textContent.includes('인쇄 가능한 유닛 '+n+'개')),ready.length);
 assert.equal(await picker.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),2);
 assert((await picker.locator('.workbook-rule-row').evaluateAll(es=>es.map(e=>Math.abs(e.querySelector('.workbook-rule-heading').getBoundingClientRect().top-e.querySelector('label').getBoundingClientRect().top)))).every(d=>d<3));
 await page.screenshot({path:out+'/alphabet-desktop.png'});
 await panel.getByRole('button',{name:'선택 지우기',exact:true}).click();assert.equal(await page.locator('.print-board').count(),0);
 await picker.locator('input:enabled').first().focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===2);
 const singleId=await page.locator('.print-board').first().getAttribute('data-unit-id');assert.equal(singleId,ready[0].id);
 await page.setViewportSize({width:390,height:844});assert.equal(await picker.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1);
 await page.evaluate(()=>document.documentElement.dataset.fontScale='xlarge');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:out+'/alphabet-mobile.png'});await page.evaluate(()=>delete document.documentElement.dataset.fontScale);await page.setViewportSize({width:1440,height:1100});
 await panel.getByRole('button',{name:'전체 선택',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.print-board').length===n*2,ready.length);
 await page.locator('.print-sheet img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));await page.evaluate(()=>document.fonts.ready);
 assert.equal(await picker.locator('input:checked').count(),ready.length);
 for(const unit of ready){const sheets=page.locator(`[data-unit-id="${unit.id}"]`);assert.equal(await sheets.count(),2);const images=await sheets.last().locator('section').first().locator('img').evaluateAll(es=>es.map(e=>e.getAttribute('src')));assert.notDeepEqual(images,unit.words.map(w=>unit.images[w]));}
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('[data-app-main]').evaluate(e=>getComputedStyle(e).marginLeft),'0px');
 if(!production)await page.pdf({path:out+'/alphabet-all.pdf',preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
 await panel.getByRole('button',{name:'선택 지우기',exact:true}).click();await picker.getByText('24. box · fox · six',{exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===2);
 const red=await page.locator('[data-workbook-word="box"]').first().locator('span').evaluateAll(es=>es.filter(e=>getComputedStyle(e).color==='rgb(225, 29, 46)').map(e=>e.textContent).join(''));assert.equal(red,'x');
 assert.deepEqual(await page.locator('.print-board').last().locator('section').nth(1).locator('[data-target-blank]').count(),3);
 if(!production){await page.emulateMedia({media:'print'});await page.locator('.print-sheet img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));await page.evaluate(()=>document.fonts.ready);await page.pdf({path:out+'/alphabet-x.pdf',preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});}
 result.checks.push('26 stable print units, shared 6-activity renderer, assets, multi-selection, keyboard, counts, X targets, deranged matching, PC/mobile');
 await page.goto(root+'/phonics?tab=course');
 if(production){await page.locator('#phonics-words-panel').waitFor();assert.equal(await page.getByRole('tab',{name:'슬라이드 수업·교재',exact:true}).count(),0);assert(await page.locator('#phonics-words-panel').isVisible());await page.goto(root+'/phonics/stage-1?view=slides&unit=stage1-abc');await page.getByText(/수업용 자료는 검토 중/).waitFor();assert.equal(await page.locator('[data-stage1-slide]').count(),0);assert(await page.getByText(/수업용 자료는 검토 중/).isVisible());result.checks.push('Production hides course tab, query bypass and old slide route');}
 else{
  const course=page.locator('[data-phonics-teaching]');await course.waitFor();assert.equal(await course.locator('.pc-teaching-panel').count(),2);
  assert.equal(await course.locator('.pc-teaching-columns').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),2);
  assert((await course.locator('[data-teaching-words]').innerText()).includes('apple · ant · axe'));
  await course.getByRole('link',{name:'기존 ABC 연계 워크북 보기',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.s1-book-page').length===8);
  await page.locator('.s1-page-picker input').nth(2).uncheck();assert.equal(await page.locator('.s1-book-page').count(),7);
  await page.goto(root+'/phonics');await page.getByRole('tab',{name:'단어·소리 학습',exact:true}).click();assert(await page.locator('#phonics-words-panel').isVisible());assert.equal(await page.locator('#phonics-words-panel a[href="/materials/phonics-stage-1"]').count(),0);
  const wordsPanel=page.locator('#phonics-words-panel');await wordsPanel.getByRole('button',{name:'2단계',exact:true}).click();await wordsPanel.locator('select').selectOption('cvc-ad');
  await wordsPanel.getByRole('button',{name:'dad 발음 듣기',exact:true}).waitFor();assert.equal(await wordsPanel.getByRole('checkbox').count(),4);
  await wordsPanel.getByRole('button',{name:/카드로 외우기/}).click();await page.locator('div[role=button][tabindex="0"]').waitFor();await page.locator('div[role=button][tabindex="0"]').click();await page.keyboard.press('Escape');await page.locator('div[role=button][tabindex="0"]').waitFor({state:'detached'});assert(await wordsPanel.getByRole('button',{name:/카드로 외우기/}).isVisible());
  await page.getByRole('tab',{name:'슬라이드 수업·교재',exact:true}).click();await page.getByRole('tab',{name:'단어·소리 학습',exact:true}).click();assert.equal(await wordsPanel.locator('select').inputValue(),'cvc-ad');
  result.checks.push('DEV-only teaching catalog, preserved ABC linked workbook, selected pages, word learning and CVC references');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);result.passed=true;console.log(JSON.stringify(result));
}catch(e){result.failure={message:e.message,url:page.url(),body:(await page.locator('body').innerText()).slice(-1500)};await page.screenshot({path:out+'/failure.png'});throw e;}
finally{await writeFile(out+`/${production?'production':'development'}-checks.json`,JSON.stringify(result,null,2));await browser.close();await server.close();}
