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
const root='http://127.0.0.1:5230';
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
const baseline=process.argv.includes('--baseline'),uiOnly=process.argv.includes('--ui-only'),out='../output/phonics-workbook-navigation';await mkdir(out,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:5230,strictPort:true},logLevel:'error'});await server.listen();
const {curriculumEntries,unitsForStep}=await server.ssrLoadModule('/src/data/phonicsCurriculum.ts');
const {buildPhonicsWorkbook,workbookPrintable}=await server.ssrLoadModule('/src/data/phonicsWorkbook.ts');
const cases=[{id:'stage1',path:'phonics-stage-1?view=workbook&unit=stage1-abc',pages:8},{id:'stage2',path:'cvc-workbook',pages:2},{id:'stage3',path:'long-vowel-workbook',pages:2},{id:'stage4-two-words',path:'phonics-stage-4-workbook',pages:2},{id:'stage4-three-words',path:'phonics-stage-4-workbook',pages:2,selectWord:'ship'},{id:'stage5',path:'phonics-stage-5-workbook',pages:2}];
const report={baseline,cases:[],errors};
async function waitImages(){await page.locator('.print-board img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await page.evaluate(()=>document.fonts.ready);}
try{
 for(const c of uiOnly?[]:cases){
  await page.goto(root+'/materials/'+c.path);await page.waitForFunction(n=>document.querySelectorAll('.print-board').length===n,c.pages);
  if(c.selectWord){await page.getByRole('button',{name:'선택 지우기',exact:true}).click();await page.locator('[data-unit-picker] label').filter({hasText:c.selectWord}).first().click();await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===2);}
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>!b.disabled&&/인쇄/.test(b.textContent)&&!/워크북|교사용/.test(b.textContent)));
  await waitImages();await page.emulateMedia({media:'print'});await page.waitForFunction(n=>document.querySelectorAll('.print-board').length===n,c.pages);assert.equal(await page.locator('.no-print:visible').count(),0);
  const signature=await page.locator('.print-board').evaluateAll(es=>es.map(e=>({text:e.innerText,images:[...e.querySelectorAll('img')].map(i=>i.getAttribute('src'))})));
  await page.pdf({path:out+'/'+(baseline?'before-':'after-')+c.id+'.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
  report.cases.push({id:c.id,pages:c.pages,signature});
 }
 const sourceFiles=['src/data/phonics/curriculum.json','src/data/phonics/words.json','src/data/phonics/stage1Course.json','src/data/phonicsStage1.ts','src/data/phonicsStage1Workbook.ts','src/data/phonicsWorkbook.ts','src/data/cvcWorkbook.ts'];
 report.sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
 if(!baseline){
  const before=JSON.parse(await readFile(out+'/before-checks.json','utf8'));assert.deepEqual(report.sourceHashes,before.sourceHashes,'canonical content and unit IDs remain unchanged');for(const c of report.cases)assert.equal(createHash('sha256').update(JSON.stringify(c)).digest('hex'),createHash('sha256').update(JSON.stringify(before.cases.find(b=>b.id===c.id))).digest('hex'),'student print content unchanged: '+c.id);
  const titles=['파닉스 워크시트 생성기','파닉스 1단계 워크북 · 알파벳과 기본 음가','파닉스 2단계 워크북 · 단모음 CVC','파닉스 3단계 워크북 · 매직 e','파닉스 4단계 워크북 · 자음군과 이중자음','파닉스 5단계 워크북 · 모음 조합·이중모음·R 모음'];
  await page.goto(root+'/materials');const section=page.locator('#materials-phonics');await section.waitFor();
  assert.deepEqual(await section.locator('.materials-card h3').allTextContents(),titles);assert.equal(await section.locator('.materials-count').textContent(),'6');assert.equal(await page.locator('a[href="#materials-phonics"] .materials-count').textContent(),'6');
  assert.equal(await section.locator('.materials-preparation').first().textContent(),'규칙·단어 선택');assert.deepEqual(await section.locator('.materials-preparation').allTextContents(),['규칙·단어 선택',...Array(5).fill('유닛별 완성 교재')]);
  assert.deepEqual((await section.locator('.materials-card-action').allTextContents()).map(t=>t.replace('→','').trim()),['활동지 만들기',...Array(5).fill('유닛 선택하기')]);
  const links=await section.locator('a.materials-card').evaluateAll(es=>es.map(e=>e.getAttribute('href')));assert.deepEqual(links,['/materials/phonics','/materials/phonics-stage-1','/materials/cvc-workbook','/materials/long-vowel-workbook','/materials/phonics-stage-4-workbook','/materials/phonics-stage-5-workbook']);
  await section.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));await page.setViewportSize({width:1440,height:1800});await section.screenshot({path:out+'/materials-phonics-desktop.png',animations:'disabled'});await page.setViewportSize({width:1440,height:1000});
  await section.locator('a.materials-card').first().click();await page.getByRole('heading',{name:titles[0],exact:true}).waitFor();await page.getByRole('button',{name:'1단계',exact:true}).click();await page.locator('a[href="/materials/phonics-stage-1"]').waitFor();
  await page.goto(root+links[1]);await page.getByRole('heading',{name:titles[1],exact:true}).waitFor();assert.equal(await page.locator('.s1-unit-cards section').count(),24);assert.equal(await page.locator('.s1-course-header a').getAttribute('href'),'/materials');
  const abc=page.locator('.s1-unit-cards section').first();assert.equal(await abc.locator('button').first().textContent(),'인쇄 워크북');await abc.getByRole('button',{name:'인쇄 워크북',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.s1-book-page').length===8);assert.equal(await page.locator('.s1-book-page').nth(2).locator('h2').textContent(),'Read and Match');
  await page.getByRole('button',{name:'교사용 안내·정답',exact:true}).first().click();assert.match(await page.locator('.s1-teacher-guide section').nth(2).locator('h3').textContent(),/Read and Match/);
  for(const [i,path] of links.entries())if(i>1){await page.goto(root+path);await page.getByRole('heading',{name:titles[i],exact:true}).waitFor();}
  report.layout=[];
  for(const step of [4,5]){
   await page.goto(root+'/materials/phonics-stage-'+step+'-workbook');const expected=buildPhonicsWorkbook(curriculumEntries(false),step).filter(workbookPrintable).length;
   await page.waitForFunction(n=>[...document.querySelectorAll('p')].some(p=>p.textContent.includes('인쇄 가능한 유닛 '+n+'개')),expected);
   const picker=page.locator('[data-unit-picker]'),panel=page.locator('[data-unit-picker-panel]'),checks=picker.locator('input[type=checkbox]:enabled');assert.equal(await checks.count(),expected);
   const checkLayout=async(columns)=>{
    assert.equal(await picker.evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),columns);
    const bounds=await picker.locator('.workbook-rule-row').evaluateAll(rows=>rows.map(row=>{const label=row.querySelector('.workbook-rule-heading').getBoundingClientRect(),unit=row.querySelector('.workbook-rule-units').getBoundingClientRect(),first=row.querySelector('label').getBoundingClientRect(),r=row.getBoundingClientRect();return {sameLine:Math.abs(label.top-first.top)<2,inRow:unit.left>=label.right-1&&unit.right<=r.right+1,overflow:[...row.querySelectorAll('label,span')].some(e=>e.scrollWidth>e.clientWidth+1)}}));assert(bounds.every(b=>b.sameLine&&b.inRow&&!b.overflow),JSON.stringify({step,columns,bounds}));
   };
   await checkLayout(2);await panel.getByRole('button',{name:'선택 지우기',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===0);assert(await page.getByRole('button',{name:'선택 유닛 인쇄',exact:true}).isDisabled());
   await checks.first().focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===2);assert(await checks.first().isChecked());
   const focus=await checks.first().evaluate(e=>getComputedStyle(e.closest('label')).outlineWidth);assert(parseFloat(focus)>=2,'keyboard focus visible');await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===0);
   await checks.nth(0).check();await checks.nth(1).check();await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===4);assert(await page.getByText('2개 유닛 · 4쪽',{exact:true}).isVisible());
   const color=await checks.first().evaluate(e=>getComputedStyle(e.closest('label')).color);assert.equal(color,'rgb(255, 255, 255)');await page.setViewportSize({width:1440,height:1800});await panel.screenshot({path:out+'/stage'+step+'-desktop.png',animations:'disabled'});await page.setViewportSize({width:1440,height:1000});
   await panel.getByRole('button',{name:'전체 선택',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.print-board').length===n*2,expected);assert.equal(await picker.locator('input:checked').count(),expected);assert.equal(await picker.locator('input:disabled:checked').count(),0);await waitImages();
   const unavailable=await picker.locator('input:disabled').evaluateAll(es=>es.map(e=>({label:e.closest('label').textContent,title:e.closest('label').title})));assert(unavailable.every(u=>u.label.includes('준비 중')&&u.title.length>0));
   await panel.getByRole('button',{name:'선택 지우기',exact:true}).click();await checks.first().check();await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===2);
   await page.setViewportSize({width:390,height:844});await checkLayout(1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewportSize({width:390,height:3600});await panel.screenshot({path:out+'/stage'+step+'-mobile.png',animations:'disabled'});await page.setViewportSize({width:390,height:844});
   for(const size of ['large','xlarge']){await page.evaluate(s=>document.documentElement.dataset.fontScale=s,size);await checkLayout(1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await page.evaluate(()=>delete document.documentElement.dataset.fontScale);
   await page.setViewportSize({width:1440,height:1000});report.layout.push({step,available:expected,disabled:unavailable,desktopColumns:2,mobileColumns:1,keyboard:true,multiSelect:true,selectAll:true,clear:true});
  }
  const saved=Object.fromEntries([4,5].map(step=>['/materials/phonics-stage-'+step+'-workbook',buildPhonicsWorkbook(curriculumEntries(false),step).filter(workbookPrintable).slice(1,3).map(u=>u.id)]));
  await context.addInitScript(saved=>{if(location.search.includes('qa-saved=1')&&saved[location.pathname])history.replaceState({usr:{phonicsUnitIds:saved[location.pathname]},key:'saved-unit-qa',idx:0},'');},saved);
  for(const path of Object.keys(saved)){await page.goto(root+path+'?qa-saved=1');await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===4);assert.equal(await page.locator('[data-unit-picker] input:checked').count(),2);}
  report.savedSelection=true;report.teacherReadAndMatch=true;
  await page.setViewportSize({width:390,height:3600});await page.goto(root+'/materials');await page.locator('#materials-phonics').screenshot({path:out+'/materials-phonics-mobile.png',animations:'disabled'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/'+(baseline?'before':uiOnly?'ui':'after')+'-checks.json',JSON.stringify({passed:true,...report},null,2));console.log('PASS: '+(baseline?'baseline saved':uiOnly?'responsive UI, keyboard, saved references and names':'print content and canonical source unchanged'));
}catch(e){await page.screenshot({path:out+'/failure.png',fullPage:true});throw e;}finally{await browser.close();await server.close();}
