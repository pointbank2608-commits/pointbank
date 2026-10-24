import { chromium } from '../../node_modules/homework-test-tools/node_modules/@playwright/test/index.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { observedBank } from '../workbooks/observed-bank.mjs';
const env=await readFile('.env.local','utf8');
const ref=env.match(/VITE_SUPABASE_URL=https:\/\/([^.]+)/)[1];
const uid='00000000-0000-4000-8000-000000000001',aid='00000000-0000-4000-8000-0000000000aa',exp=Math.floor(Date.now()/1000)+86400;
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const user={id:uid,aud:'authenticated',role:'authenticated',email:'phonics-test@example.com',app_metadata:{},user_metadata:{}};
const session={access_token:`${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:uid,role:'authenticated',exp,aud:'authenticated'})}.test-only`,refresh_token:'test-only',expires_at:exp,expires_in:86400,token_type:'bearer',user};
const profile={id:uid,academy_id:aid,role:'owner',display_name:'Phonics QA'};
const academy={id:aid,name:'QA',point_unit:'별',plan:'paid',plan_status:'active',deletion_requested_at:null,features:{group:true,solo:true,homework:true}};
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('classbank.lang','ko');localStorage.setItem('classbank.printWatermark','off');},{key:`sb-${ref}-auth-token`,session});
let mediaRows=[]; let savedPayload=null;
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=req.url(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
 if(req.method()==='POST' && url.includes('/rest/v1/curriculum_lessons')){ savedPayload=req.postDataJSON();return route.fulfill({status:201,headers,json:{...savedPayload,id:'stage1-qa-saved'}}); } if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 const single=(req.headers().accept??'').includes('vnd.pgrst.object');let data=single?{}:[];
 if(url.includes('/rest/v1/rpc/my_deletion_request'))data=null;else if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/'))data=session;
 else if(url.includes('/rest/v1/profiles'))data=single?profile:[profile];else if(url.includes('/rest/v1/academies'))data=single?academy:[academy];
 else if(url.includes('/rest/v1/phonics_bank'))data=mediaRows;
 return route.fulfill({status:200,headers,json:data});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const root='http://127.0.0.1:5224';
import { createServer } from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:5224,strictPort:true},logLevel:'error'});
await server.listen();
const {buildStage1Course}=await server.ssrLoadModule('/src/data/phonicsStage1.ts');
const course=buildStage1Course(),unit=course[0];
const out='../output/phonics-stage1';await mkdir(out,{recursive:true});
const report={slides:[],workbooks:[],scenePositions:[],mediaOverride:false,saved:false,errors};
const url=(u,view,extras={})=>root+'/materials/phonics-stage-1?'+new URLSearchParams({unit:u.id,view,...extras});
async function images(){await page.locator('.s1-course img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));}
async function book(u){await page.goto(url(u,'workbook'));await page.waitForFunction(n=>document.querySelectorAll('.s1-book-page').length===n,u.pages.length);await images();await page.evaluate(()=>document.fonts.ready);}
async function bookMetrics(){return page.locator('.s1-book-page').evaluateAll(pages=>pages.map(p=>{
 const body=p.querySelector('.s1-book-page-body'),r=p.getBoundingClientRect(),b=body.getBoundingClientRect();
 return {id:p.dataset.stage1Page,width:r.width,height:r.height,overflow:body.scrollHeight-body.clientHeight,outside:[...body.children].filter(c=>c.getBoundingClientRect().bottom>b.bottom+2).map(c=>c.className)};
}));}
try {
 await page.goto(root+'/materials/phonics-stage-1');await page.locator('.s1-unit-cards section').last().waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.s1-unit-cards button')].every(b=>!b.disabled));
 assert.equal(await page.locator('.s1-unit-cards section').count(),24);
 await page.screenshot({path:out+'/units-desktop.png',fullPage:true});
 for(const section of [{lesson:'1',optional:'0'},{lesson:'2',optional:'0'},{lesson:'2',optional:'1'}]){
  await page.goto(url(unit,'slides',section));await page.locator('.s1-slide-navigation select').waitFor();
  const slides=unit.slides.filter(s=>section.optional==='1'?s.optional:!s.optional&&s.lesson===Number(section.lesson));
  assert.equal(await page.locator('.s1-slide-navigation option').count(),slides.length);
  for(const s of slides){
   await page.locator('.s1-slide-navigation select').selectOption(s.id);await page.waitForFunction(id=>document.querySelector('.s1-slide')?.dataset.stage1Slide===id,s.id);await images();
   assert.equal(await page.locator('.s1-slide').getAttribute('data-stage1-slide'),s.id);
   assert.equal(await page.locator('.s1-media-error').count(),0);
   if(s.kind==='quiz'&&s.phase==='question')assert.equal(await page.locator('.s1-slide .s1-word').count(),0);
   if(s.kind==='quiz'&&s.phase==='answer')assert.equal(await page.locator('.s1-slide .s1-word').count(),1);
   await page.locator('svg[data-shadow] image').evaluateAll(es=>Promise.all(es.map(e=>{const img=new Image();img.src=e.getAttribute('href');return img.decode();})));
   if(s.kind==='quiz'&&s.phase==='question'&&s.lesson===2)await page.locator('.s1-slide').screenshot({path:out+'/shadow-'+s.wordIds[0]+'.png'});
   if(s.kind==='missing'){
    assert.deepEqual(await page.locator('[data-memory-word]').evaluateAll(es=>es.map(e=>e.dataset.memoryWord)),s.wordIds);
    const round=unit.rounds.find(r=>r.id===s.roundId);
    assert.equal(await page.locator('.s1-question-mark').count(),s.phase==='question'?round.missing.length:0);
   }
   if(['scene','read','together','yourTurn'].includes(s.kind)){
    const slots=await page.locator('[data-scene-word]').evaluateAll(es=>es.map(e=>({id:e.dataset.sceneWord,left:e.style.left,top:e.style.top,width:e.style.width,height:e.style.height})));
    report.scenePositions.push(slots);assert.deepEqual(slots,report.scenePositions[0]);
    assert.equal(await page.locator('.s1-scene-arrow').count(),s.kind==='read'?1:0);
    if(s.kind==='yourTurn'){await page.locator('[data-scene-word]').first().click();assert.equal(await page.locator('[data-your-turn]').textContent(),'I see a _____.');}
   }
   const clip=await page.locator('.s1-slide-body').evaluate(b=>{const r=b.getBoundingClientRect();return [...b.children].filter(c=>c.getBoundingClientRect().bottom>r.bottom+3).map(c=>c.className);});
   assert.deepEqual(clip,[],'slide overflow '+s.id);
   report.slides.push({id:s.id,kind:s.kind,number:unit.slides.indexOf(s)+1});
   if([4,25,46,54,68,73].includes(unit.slides.indexOf(s)+1))await page.locator('.s1-slide').screenshot({path:out+'/slide-'+String(unit.slides.indexOf(s)+1).padStart(2,'0')+'.png'});
  }
 }
 assert.equal(report.slides.length,98);
 await page.getByRole('button',{name:'화면 크게 보기',exact:true}).click();
 for(const size of [{width:1366,height:768},{width:1920,height:1080}]){await page.setViewportSize(size);const full=await page.locator('.s1-slide').boundingBox();assert(full.y+full.height<=size.height,'large slide fits');}
 await page.setViewportSize({width:1440,height:1000});
 await page.keyboard.press('Escape');assert.equal(await page.locator('.s1-player-large').count(),0);
 for(const u of course){
  await book(u);
  assert.equal(await page.locator('.s1-book-page h2').nth(2).textContent(),'Read and Match');
  assert.equal(await page.locator('.s1-book-page [data-writing=independent] span').count(),0,'no independent answers');
  assert.equal(await page.locator('[data-audience=teacher]').count(),0,'separate student DOM');
  await page.emulateMedia({media:'print'});
  const metrics=await bookMetrics();for(const m of metrics){assert(m.overflow<=2,'book overflow '+m.id+' '+m.overflow);assert.deepEqual(m.outside,[],m.id);}
  await page.pdf({path:out+'/'+u.id+'-workbook.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});
  report.workbooks.push({id:u.id,pages:u.pages.length,metrics});
  if(u.id===unit.id){
   await page.locator('.s1-book-page').nth(0).screenshot({path:out+'/workbook-page1.png'});
   await page.locator('.s1-book-page').nth(4).screenshot({path:out+'/workbook-page5.png'});
   await page.locator('.s1-book-page').nth(6).screenshot({path:out+'/workbook-page7.png'});
   await page.locator('.s1-book-page').nth(7).screenshot({path:out+'/workbook-page8.png'});
   await page.emulateMedia({media:'screen'});
   await page.getByRole('button',{name:'선택 해제',exact:true}).click();assert.equal(await page.locator('.s1-book-page').count(),0);
   assert(await page.getByRole('button',{name:'선택한 쪽 인쇄',exact:true}).isDisabled());
   await page.locator('.s1-page-picker label').nth(2).click();assert.equal(await page.locator('.s1-book-page').count(),1);
   await page.emulateMedia({media:'print'});await page.pdf({path:out+'/unit1-selected-page3.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});
   await page.emulateMedia({media:'screen'});await page.getByRole('button',{name:'전체 선택',exact:true}).click();assert.equal(await page.locator('.s1-book-page').count(),8);
  }
  await page.emulateMedia({media:'screen'});
 }
 await page.goto(url(unit,'teacher'));await page.locator('.s1-teacher-guide').waitFor();assert.equal(await page.locator('.s1-book-page').count(),0);
 await page.emulateMedia({media:'print'});await page.pdf({path:out+'/unit1-teacher-guide.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
 await page.getByRole('button',{name:'내 수업에 저장하기',exact:true}).click();await page.getByRole('status').filter({hasText:'수업을 저장했습니다'}).waitFor();
 assert.equal(savedPayload.playlist.length,3);assert.deepEqual(savedPayload.playlist.map(s=>s.phonicsStage1.view),['slides','slides','workbook']);assert.deepEqual(savedPayload.playlist.map(s=>s.phonicsStage1.lesson),[1,2,1]);report.saved=true;
 const words=JSON.parse(await readFile('src/data/phonics/words.json','utf8'));const apple=words['pw-apple'];
 const media='/qa-stage1/apple-uploaded-v2.webp';await context.route('**'+media,r=>r.fulfill({contentType:'image/webp',path:'public'+apple.imageUrl}));mediaRows=[{id:'qa-new',word:'APPLE',image_url:media,sort_order:1}];
 await book(unit);assert((await page.locator('img[src="'+media+'"]').count())>0);await page.emulateMedia({media:'print'});assert((await page.locator('img[src="'+media+'"]:visible').count())>0);await page.emulateMedia({media:'screen'});
 await page.goto(root+'/phonics');await page.locator('img[src="'+media+'"]').first().waitFor();report.mediaOverride=true;
 const newQuiz=unit.slides.find(s=>s.optional&&s.kind==='quiz'&&s.phase==='question'&&s.wordIds[0]==='pw-apple');await page.goto(url(unit,'slides',{lesson:'2',optional:'1',slide:newQuiz.id}));await page.locator('.s1-slide img[src="'+media+'"]').waitFor();assert.equal(await page.locator('[data-shadow]').count(),0,'do not pair an old shadow with a new color picture');
 await page.setViewportSize({width:390,height:844});await page.goto(root+'/materials/phonics-stage-1');await page.locator('.s1-unit-cards section').last().waitFor();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overview no horizontal overflow');await page.screenshot({path:out+'/units-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);await writeFile(out+'/browser-checks.json',JSON.stringify({passed:true,...report},null,2));console.log('PASS: 98 slides, 24 workbooks, selected print, teacher print, current media and lesson saving.');
} catch(e){await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw e;} finally {await browser.close();await server.close();}


