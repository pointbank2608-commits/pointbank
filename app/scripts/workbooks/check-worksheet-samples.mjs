import {chromium} from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import {createServer} from 'vite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const out='../output/worksheet-studio',pdfOut='../tmp/pdfs/worksheet-studio';await mkdir(out,{recursive:true});await mkdir(pdfOut,{recursive:true});
const env=await readFile('.env.local','utf8'),ref=env.match(/VITE_SUPABASE_URL=https:\/\/([^.]+)/)[1];
const uid='00000000-0000-4000-8000-000000000001',aid='00000000-0000-4000-8000-0000000000aa';
const exp=Math.floor(Date.now()/1000)+86400,b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const user={id:uid,aud:'authenticated',role:'authenticated',email:'worksheet-qa@example.test',app_metadata:{},user_metadata:{}};
const session={access_token:`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:uid,role:'authenticated',exp,aud:'authenticated'})}.test-only`,refresh_token:'test-only',expires_at:exp,expires_in:86400,token_type:'bearer',user};
const profile={id:uid,academy_id:aid,role:'owner',display_name:'Worksheet QA'},academy={id:aid,name:'Worksheet QA',point_unit:'별',plan:'paid',plan_status:'active',deletion_requested_at:null,features:{group:true,solo:true,homework:true}};
const server=await createServer({server:{host:'127.0.0.1',port:5246,strictPort:true},logLevel:'error'});await server.listen();
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
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const root=process.env.STUDIO_QA_URL||'http://127.0.0.1:5246';
const report={passed:false,activities:[],errors},pdf=process.argv.includes('--pdf'),smoke=process.argv.includes('--smoke');
async function open(id){await page.goto(root+'/materials/worksheet?activity='+id);await page.locator(`[data-worksheet-editor="${id}"]`).waitFor();await page.getByRole('button',{name:'학생용 인쇄',exact:true}).waitFor();}
async function assertReady(id){await page.waitForFunction(()=>{const buttons=[...document.querySelectorAll('button')],print=buttons.find(e=>e.textContent==='학생용 인쇄'),refresh=buttons.find(e=>e.textContent==='내 자료 새로 불러오기');return print&&!print.disabled&&refresh&&!refresh.disabled&&!document.querySelector('.ws-validation');});assert.equal(await page.locator('.ws-validation').count(),0,id+' valid example');}
const sampleReport={passed:false,activities:[],errors};
try{
 const expected=JSON.parse(await readFile(out+'/pdf-checks.json','utf8'));
 const saved=exampleWorksheet('pictureWrite');saved.title='선생님이 수정한 기존 활동지';
 await page.goto(root+'/materials/worksheet');await page.locator('[data-worksheet-hub]').waitFor();
 const initial=JSON.stringify({current:{pictureWrite:saved},copies:[]});
 await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:studioKey(uid,aid),value:initial});
 await page.reload();await page.locator('[data-worksheet-hub]').waitFor();
 while(await page.getByRole('button',{name:'활동 더 보기',exact:true}).count())await page.getByRole('button',{name:'활동 더 보기',exact:true}).click();
 const thumbnails=page.locator('[data-sample-open]');assert.equal(await thumbnails.count(),81);
 await page.screenshot({path:out+'/samples-desktop.png',fullPage:true});
 await page.screenshot({path:out+'/samples-desktop-viewport.png'});
 for(const a of [...WORKSHEET_ACTIVITIES,...WORKSHEET_BASIC_ACTIVITIES]){
  const button=page.locator(`[data-sample-open="${a.id}"]`);await button.scrollIntoViewIfNeeded();await button.locator('img').evaluate(i=>i.decode());
  await button.click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert(await dialog.evaluate(e=>e.open));
  for(const audience of ['student','teacher']){
   if(audience==='teacher')await dialog.getByRole('button',{name:'교사용 설명·답안',exact:true}).click();
   const preview=dialog.locator('[data-sample-audience]');await preview.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
   const count=await preview.locator('.print-board').count();
   assert.equal(count,expected.results.find(r=>r.id===a.id).views.find(v=>v.audience===audience).pages,a.id+' all '+audience+' pages');
   assert(!/worksheetStudio\./.test(await dialog.innerText()));
   assert(await preview.evaluate(e=>e.scrollWidth<=e.clientWidth+2),a.id+' no horizontal clipping');
   if(a.id==='informationGap'&&audience==='student')await page.screenshot({path:out+'/sample-dialog-desktop.png'});
  }
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  assert(await button.evaluate(e=>e===document.activeElement),'Focus returns to sample button');sampleReport.activities.push(a.id);
 }
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),studioKey(uid,aid)),initial,'Read-only samples preserve current work');
 for(const id of ['soundBoxes','informationGap','basic-miniBook','listenColor']){
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='125%');
  await page.locator(`[data-sample-open="${id}"]`).click();const dialog=page.getByRole('dialog');
  await dialog.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+2),id+' mobile dialog');
  assert(await dialog.locator('.ws-sample-viewport').evaluate(e=>e.scrollWidth<=e.clientWidth+2),id+' mobile pages');
  for(let n=0;n<8;n++){await page.keyboard.press('Tab');assert(await dialog.evaluate(e=>e.contains(document.activeElement)),'Focus is trapped in modal');}
  await page.screenshot({path:out+`/sample-${id}-mobile.png`});await dialog.getByRole('button',{name:'닫기',exact:true}).click();
 }
 await page.evaluate(()=>document.documentElement.style.fontSize='');await page.setViewportSize({width:1440,height:1100});
 await page.locator('[data-sample-open="pictureWrite"]').click();await page.getByRole('dialog').getByRole('button',{name:'이 샘플로 만들기',exact:true}).click();
 await page.locator('[data-worksheet-editor="pictureWrite"]').waitFor();
 const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),studioKey(uid,aid));
 assert.equal(stored.copies.length,1);assert.equal(stored.copies[0].document.title,saved.title);assert.notEqual(stored.current.pictureWrite.title,saved.title);
 await page.getByRole('button',{name:'자료 교체 되돌리기',exact:true}).click();
 assert.equal(await page.locator('.ws-task-editor').getByLabel('활동지 제목',{exact:true}).inputValue(),saved.title);
 await page.getByRole('button',{name:'샘플 보기',exact:true}).click();
 await page.evaluate(()=>{window.__storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('classbank:worksheets:'))throw new DOMException('Quota exceeded','QuotaExceededError');return window.__storageSet.call(this,key,value);};});
 await page.getByRole('dialog').getByRole('button',{name:'이 샘플로 만들기',exact:true}).click();assert(await page.getByRole('dialog').isVisible());
 await page.getByRole('dialog').getByRole('alert').waitFor();
 assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),studioKey(uid,aid))).current.pictureWrite.title,saved.title);
 await page.evaluate(()=>Storage.prototype.setItem=window.__storageSet);await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);sampleReport.passed=true;
 console.log('PASS: 81 thumbnails, all student/teacher sample pages, read-only viewing, mobile/large text, Escape/focus, sample editing, backup/undo and quota safety');
}catch(e){sampleReport.failure={message:e.message,url:page.url(),body:(await page.locator('body').innerText()).slice(-2500)};await page.screenshot({path:out+'/samples-failure.png'});throw e;}
finally{await writeFile(out+'/samples-checks.json',JSON.stringify(sampleReport,null,2));await browser.close();await server.close();}
