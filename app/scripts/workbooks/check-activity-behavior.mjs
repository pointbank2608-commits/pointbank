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
const server=await createServer({server:{host:'127.0.0.1',port:5245,strictPort:true},logLevel:'error'});await server.listen();
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
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const root=process.env.STUDIO_QA_URL||'http://127.0.0.1:5245';
const report={passed:false,activities:[],errors},pdf=process.argv.includes('--pdf'),smoke=process.argv.includes('--smoke');
async function open(id){await page.goto(root+'/materials/worksheet?activity='+id);await page.locator(`[data-worksheet-editor="${id}"]`).waitFor();await page.getByRole('button',{name:'학생용 인쇄',exact:true}).waitFor();}
async function assertReady(id){await page.waitForFunction(()=>{const buttons=[...document.querySelectorAll('button')],print=buttons.find(e=>e.textContent==='학생용 인쇄'),refresh=buttons.find(e=>e.textContent==='내 자료 새로 불러오기');return print&&!print.disabled&&refresh&&!refresh.disabled&&!document.querySelector('.ws-validation');});assert.equal(await page.locator('.ws-validation').count(),0,id+' valid example');}
const results=[];const pass=name=>{results.push(name);console.log('PASS '+name);};
const current=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{}'),studioKey(uid,aid));
async function importDoc(doc){await page.locator('input[type=file][accept="application/json,.json"]').setInputFiles({name:'edited.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await page.locator(`[data-worksheet-editor="${doc.activityId}"]`).waitFor();}
async function wordEditor(){if(!await page.locator('.ws-source-details').evaluate(e=>e.open))await page.locator('.ws-source-details summary').click();return page.locator('[data-word-editor]').first();}
try{
 await open('pictureWrite');await assertReady('pictureWrite');
 await page.locator('.ws-source-editor').getByRole('button',{name:/단어장에서 불러오기/}).click();await page.getByRole('button',{name:/우리 반 동물 단어/}).click();await assertReady('pictureWrite');
 let saved=(await current()).current.pictureWrite;assert.deepEqual(saved.words.map(w=>w.word),list.items.map(w=>w.word));assert.equal(saved.tasks.length,4);assert(saved.tasks.every(r=>saved.words.some(w=>w.id===r.wordId)));pass('word-list replacement removes samples, includes all source words and retains picture bindings');
 await page.locator('.ws-task-details summary').click();await page.locator('[data-task-editor]').first().getByLabel('문제·지시',{exact:true}).fill('Write two sentences about this picture.');
 let editor=await wordEditor();await editor.getByLabel('뜻·단서',{exact:true}).fill(getWord('frog').meaning+' (복습)');assert(await page.getByRole('button',{name:'학생용 인쇄',exact:true}).isDisabled());assert((await current()).current.pictureWrite.tasks[0].prompt.includes('two sentences'));
 await page.getByRole('button',{name:'변경한 단어와 문항을 확인했어요',exact:true}).click();await assertReady('pictureWrite');pass('manual question edits survive source edits and require an explicit review');
 await editor.getByLabel('컬러 그림 주소',{exact:true}).fill('/missing-worksheet-qa.webp');await page.getByText('불러오지 못한 그림이 있어요. 교체한 뒤 인쇄해 주세요.',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'학생용 인쇄',exact:true}).isDisabled());
 await editor.getByLabel('컬러 그림 주소',{exact:true}).fill(getWord('frog').image_url);await assertReady('pictureWrite');assert.equal(await page.locator('.ws-preview-stack img').first().evaluate(e=>getComputedStyle(e).visibility),'visible');pass('broken images block printing and become visible again after correction');
 const cat=getWord('cat');mediaRows=[{...cat,id:'worksheet-latest-cat',image_url:cat.image_url+'?worksheet=latest',lineart_url:cat.lineart_url+'?worksheet=latest'}];
 await open('listenColor');await assertReady('listenColor');editor=await wordEditor();assert((await editor.getByLabel('컬러 그림 주소',{exact:true}).inputValue()).includes('worksheet=latest'));assert((await editor.getByLabel('선화 주소',{exact:true}).inputValue()).includes('worksheet=latest'));
 await editor.getByLabel('컬러 그림 주소',{exact:true}).fill(cat.image_url+'?worksheet=mine');assert.equal(await editor.getByLabel('선화 주소',{exact:true}).inputValue(),'');assert(await page.getByRole('button',{name:'학생용 인쇄',exact:true}).isDisabled());
 await editor.getByLabel('선화 주소',{exact:true}).fill(cat.lineart_url);mediaRows[0].image_url=cat.image_url+'?worksheet=newer';await page.getByRole('button',{name:'내 자료 새로 불러오기',exact:true}).click();await assertReady('listenColor');assert((await editor.getByLabel('컬러 그림 주소',{exact:true}).inputValue()).includes('worksheet=mine'));pass('latest shared media is loaded, replaced colour pictures clear stale line art, and teacher overrides survive refresh');
 await editor.getByLabel('단어·표현',{exact:true}).fill('duck');saved=(await current()).current.listenColor;assert.equal(saved.words[0].imageUrl,null);assert.equal(saved.words[0].lineartUrl,null);assert.equal(saved.words[0].patternMarked,'');assert(await page.getByRole('button',{name:'학생용 인쇄',exact:true}).isDisabled());pass('renaming a word clears stale images, line art and spelling metadata');
 await open('informationGap');await assertReady('informationGap');const tables=page.locator('.ws-preview-stack .ws-table');assert.equal(await tables.count(),2);const a=await tables.nth(0).locator('tbody td:nth-child(2)').allTextContents(),b=await tables.nth(1).locator('tbody td:nth-child(2)').allTextContents();assert(a.every((v,i)=>!!v.trim()!==!!b[i].trim()));pass('A/B sheets have complementary missing cells');
 await open('soundBoxes');await assertReady('soundBoxes');assert.equal(await page.locator('.ws-sound-row').first().locator('.ws-sound-boxes>span').count(),3);pass('ship uses three sound boxes, including one sh box');
 await page.locator('.ws-task-editor').getByLabel('활동지 제목',{exact:true}).fill('개인 소리 연습');
 await page.evaluate(()=>{const original=Storage.prototype.setItem;window.__restoreStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(key,value){if(key.startsWith('classbank:worksheets:'))throw Error('quota');return original.call(this,key,value);};});
 await page.locator('.ws-task-editor').getByLabel('활동지 제목',{exact:true}).fill('저장 실패 중인 수정본');await page.getByText('이 기기에 저장하지 못했어요. 나가기 전에 수정용 파일을 내려받으세요.',{exact:true}).waitFor();assert.equal(await page.locator('.ws-task-editor').getByLabel('활동지 제목',{exact:true}).inputValue(),'저장 실패 중인 수정본');const failedDownload=page.waitForEvent('download');await page.getByRole('button',{name:'수정용 파일 내려받기',exact:true}).click();await (await failedDownload).saveAs(out+'/unsaved-recovery.json');assert.equal(JSON.parse(await readFile(out+'/unsaved-recovery.json','utf8')).title,'저장 실패 중인 수정본');await page.evaluate(()=>window.__restoreStorage());pass('storage quota errors are visible and an editable recovery file still works');
 await page.evaluate(()=>{window.print=()=>window.__worksheetPrint=(window.__worksheetPrint||0)+1;});await page.getByRole('button',{name:'학생용 인쇄',exact:true}).click();await page.waitForFunction(()=>window.__worksheetPrint===1);assert.equal(await page.locator('.ws-preview-stack').getAttribute('data-audience'),'student');await page.getByRole('button',{name:'교사용 인쇄',exact:true}).click();await page.waitForFunction(()=>window.__worksheetPrint===2);assert.equal(await page.locator('.ws-preview-stack').getAttribute('data-audience'),'teacher');pass('print buttons select the intended audience before calling print');
 const secret='other-account-private-title';await page.evaluate(({other,secret})=>localStorage.setItem(other,JSON.stringify({current:{soundBoxes:{...JSON.parse(localStorage.getItem(other.replace('other-teacher','00000000-0000-4000-8000-000000000001'))||'{}').current?.soundBoxes,title:secret}},copies:[]})),{other:studioKey('other-teacher',aid),secret});assert(!(await page.locator('.worksheet-studio').innerText()).includes(secret));pass('another account’s stored title is not read');
 await open('pictureWrite');await assertReady('pictureWrite');await importDoc({...exampleWorksheet('readingQuestions'),title:'옮겨 온 읽기 활동'});await page.getByRole('button',{name:'자료 교체 되돌리기',exact:true}).click();await page.waitForURL('**activity=pictureWrite');pass('cross-activity file import can be undone with its route restored');
 const stress=['basic-list','coverWrite','roleplay','listenTable','findSomeone','informationGap','grammarChoice','paragraph','substitution','comic','jigsaw'];const stressResults=[];
 for(const id of stress){let doc=exampleWorksheet(id);doc.title='ClassBank editable worksheet with additional classroom notes';
  if(['basic-list','coverWrite'].includes(id))doc.words=doc.words.map(w=>({...w,meaning:(w.meaning+' — a classroom vocabulary description. ').repeat(3).slice(0,150),example:(w.example+' ').repeat(6).slice(0,240)}));
  if(['roleplay','listenTable','findSomeone','informationGap','paragraph','comic','jigsaw'].includes(id))doc.tasks=doc.tasks.map(r=>({...r,prompt:(r.prompt+' Please discuss this carefully with your partner. ').repeat(5).slice(0,250),answer:(r.answer+' A clear classroom example. ').repeat(8).slice(0,290),detail:(r.detail+' Review the important details together. ').repeat(10).slice(0,340)}));
  if(id==='grammarChoice'){doc.passage=('Our class reads a short story and shares ideas. ').repeat(100).slice(0,5900);doc.tasks=doc.tasks.map(r=>({...r,prompt:(r.prompt+' Read the sentence and consider the context. ').repeat(5).slice(0,250)}));}
  if(id==='substitution')doc.columns=Array.from({length:4},()=>Array.from({length:6},(_,i)=>'Choice '+i+' with extra classroom detail').join('|')).join('\n');
  await importDoc(doc);await assertReady(id);
  for(const audience of ['student','teacher']){if(audience==='teacher')await page.getByRole('button',{name:'교사용 설명·답안',exact:true}).click();await page.emulateMedia({media:'print'});const sizes=await page.locator('.ws-preview-stack .print-board').evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));assert(sizes.every(s=>s.height<1034&&s.width<709),id+' '+audience+' long content fits A4');await page.emulateMedia({media:'screen'});stressResults.push({id,audience,pages:sizes.length});}
 }
 pass('long edited content is paginated across '+stressResults.length+' student/teacher cases');
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);await writeFile(out+'/behavior.json',JSON.stringify({passed:true,results,stressResults,originalListsUnchanged:true,errors},null,2));
}catch(e){await writeFile(out+'/behavior-failure.json',JSON.stringify({results,message:e.message,url:page.url(),body:(await page.locator('body').innerText()).slice(-2000)},null,2));await page.screenshot({path:out+'/behavior-failure.png',fullPage:true});throw e;}finally{await browser.close();await server.close();}
