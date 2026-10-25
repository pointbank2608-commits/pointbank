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
const server=await createServer({server:{host:'127.0.0.1',port:5244,strictPort:true},logLevel:'error'});await server.listen();
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
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const root=process.env.STUDIO_QA_URL||'http://127.0.0.1:5244';
const report={passed:false,activities:[],errors},pdf=process.argv.includes('--pdf'),smoke=process.argv.includes('--smoke');
async function open(id){await page.goto(root+'/materials/worksheet?activity='+id);await page.locator(`[data-worksheet-editor="${id}"]`).waitFor();await page.getByRole('button',{name:'학생용 인쇄',exact:true}).waitFor();}
async function assertReady(id){await page.waitForFunction(()=>{const buttons=[...document.querySelectorAll('button')],print=buttons.find(e=>e.textContent==='학생용 인쇄'),refresh=buttons.find(e=>e.textContent==='내 자료 새로 불러오기');return print&&!print.disabled&&refresh&&!refresh.disabled&&!document.querySelector('.ws-validation');});assert.equal(await page.locator('.ws-validation').count(),0,id+' valid example');}
try{
 await page.goto(root+'/materials/worksheet');await page.locator('[data-worksheet-hub]').waitFor();assert.equal(await page.locator('.ws-purpose-nav button').count(),10);
 await page.getByRole('button',{name:/글로 표현하기 8/}).click();assert.equal(await page.locator('[data-activity-card]').count(),8);await page.screenshot({path:out+'/purpose-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='125%');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'/purpose-mobile-large.png',fullPage:true});
 await page.evaluate(()=>document.documentElement.style.fontSize='');await page.setViewportSize({width:1440,height:1100});
 const all=smoke?[WORKSHEET_ACTIVITIES[1],...['informationGap','pictureWrite','storyMap','crossword','bingo','listenColor','roleplay','jigsaw','sequence','substitution'].map(id=>WORKSHEET_ACTIVITIES.find(a=>a.id===id)),WORKSHEET_BASIC_ACTIVITIES[4]]:[...WORKSHEET_ACTIVITIES,...WORKSHEET_BASIC_ACTIVITIES];
 for(const a of all.filter(a=>!process.env.STUDIO_QA_ONLY||a.id===process.env.STUDIO_QA_ONLY)){
  await open(a.id);await assertReady(a.id);const result={id:a.id,audiences:[]};
  for(const audience of ['student','teacher']){
   if(audience==='teacher')await page.getByRole('button',{name:'교사용 설명·답안',exact:true}).click();
   await page.locator('.ws-preview-stack .print-board').first().waitFor();await page.locator('.ws-preview-stack img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await page.evaluate(()=>document.fonts.ready);
   assert(!/worksheetStudio\.|common\.(showMore|refresh)/.test(await page.locator('.worksheet-studio').innerText()),a.id+' translated strings');
   await page.emulateMedia({media:'print'});
   assert.equal(await page.locator('[data-app-main]').evaluate(e=>getComputedStyle(e).marginLeft),'0px','No navigation gutter on printed worksheets');
   const dimensions=await page.locator('.ws-preview-stack .print-board').evaluateAll(es=>es.map(e=>({width:Math.round(e.getBoundingClientRect().width),height:Math.round(e.getBoundingClientRect().height),scroll:e.scrollHeight,landscape:e.classList.contains('print-landscape'),text:e.innerText.slice(0,60)})));
   assert(dimensions.length>0,a.id+' printed pages');
   const overflow=dimensions.filter(d=>d.landscape?(d.height>741||d.width>1068):(d.height>1034||d.width>709));if(overflow.length)console.log('OVERFLOW '+a.id+' '+audience+' '+JSON.stringify(overflow));
   if(pdf)await page.pdf({path:pdfOut+'/'+a.id+'-'+audience+'.pdf',preferCSSPageSize:true,printBackground:true});
   result.audiences.push({audience,pages:dimensions.length,dimensions,overflow:overflow.length});await page.emulateMedia({media:'screen'});
  }
  report.activities.push(result);console.log('CHECK '+report.activities.length+'/'+all.length+' '+a.id);
 }
 await open('pictureWrite');await assertReady('pictureWrite');await page.locator('.ws-source-details summary').click();const first=page.locator('[data-word-editor]').first();
 await first.getByLabel('단어·표현',{exact:true}).fill('frog');await first.getByLabel('뜻·단서',{exact:true}).fill(getWord('frog').meaning);await first.getByLabel('컬러 그림 주소',{exact:true}).fill(getWord('frog').image_url);
 await page.locator('.ws-task-editor').getByLabel('활동지 제목',{exact:true}).fill('우리 반 개구리 쓰기');await assertReady('pictureWrite');
 assert((await page.locator('.ws-preview-stack img').first().getAttribute('src')).includes('frog'));
 const expected=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).current.pictureWrite,studioKey(uid,aid));assert.equal(expected.words[0].word,'frog');assert.equal(expected.words[0].example,'');
 await page.reload();await page.locator('[data-worksheet-editor="pictureWrite"]').waitFor();assert.equal(await page.locator('.ws-task-editor').getByLabel('활동지 제목',{exact:true}).inputValue(),'우리 반 개구리 쓰기');
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'수정용 파일 내려받기',exact:true}).click();const download=await downloadEvent;await download.saveAs(out+'/editable-roundtrip.json');const exported=JSON.parse(await readFile(out+'/editable-roundtrip.json','utf8'));assert.equal(exported.words[0].word,'frog');
 await page.getByLabel('사본 이름',{exact:true}).fill('반별 활동지 사본');await page.getByRole('button',{name:'이름 붙여 사본 저장',exact:true}).click();
 await page.getByRole('button',{name:'다른 활동 찾기',exact:false}).click();await page.locator('[data-worksheet-hub]').waitFor();await page.locator('input[type=file][accept="application/json,.json"]').setInputFiles(out+'/editable-roundtrip.json');await page.locator('[data-worksheet-editor="pictureWrite"]').waitFor();assert.equal(await page.locator('.ws-task-editor').getByLabel('활동지 제목',{exact:true}).inputValue(),'우리 반 개구리 쓰기');
 const before=await page.locator('.ws-task-editor').getByLabel('활동지 제목',{exact:true}).inputValue();await page.locator('input[type=file][accept="application/json,.json"]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"schema":"wrong"}')});await page.getByText('지원하는 활동지 파일이 아니에요. 현재 수정 내용은 유지했어요.',{exact:true}).waitFor();assert.equal(await page.locator('.ws-task-editor').getByLabel('활동지 제목',{exact:true}).inputValue(),before);
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+'/editor-mobile.png',fullPage:true});
 assert.deepEqual(writes,[],'No original word list or other user data is modified');assert.deepEqual(errors,[]);
 report.passed=report.activities.every(a=>a.audiences.every(r=>r.overflow===0));report.editing=true;report.reload=true;report.editableFiles=true;report.originalListsUnchanged=true;
 await writeFile(out+(process.env.STUDIO_QA_ONLY?'/ui-focused.json':smoke?'/ui-smoke.json':'/ui-checks.json'),JSON.stringify(report,null,2));
 assert(report.passed,'No A4 overflow');console.log('PASS editing, reload, editable-file import/export, named copies, invalid-file safety and mobile layout');
}catch(e){report.failure={message:e.message,url:page.url(),body:(await page.locator('body').innerText()).slice(-2500)};await writeFile(out+'/ui-failure.json',JSON.stringify(report,null,2));await page.screenshot({path:out+'/ui-failure.png',fullPage:true});throw e;}finally{await browser.close();await server.close();}
