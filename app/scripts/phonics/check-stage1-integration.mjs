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
let mediaRows=[]; let savedPayload=null; let savedLesson=null;
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=req.url(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
 if(req.method()==='POST' && url.includes('/rest/v1/curriculum_lessons')){ savedPayload=req.postDataJSON();return route.fulfill({status:201,headers,json:{...savedPayload,id:'stage1-qa-saved'}}); } if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 const single=(req.headers().accept??'').includes('vnd.pgrst.object');let data=single?{}:[];
 if(url.includes('/rest/v1/rpc/my_deletion_request'))data=null;else if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/'))data=session;
 else if(url.includes('/rest/v1/profiles'))data=single?profile:[profile];else if(url.includes('/rest/v1/academies'))data=single?academy:[academy];
 else if(url.includes('/rest/v1/curriculum_lessons')){if(req.method()==='PATCH')savedLesson={...savedLesson,...req.postDataJSON()};data=single?savedLesson:(savedLesson?[savedLesson]:[]);} else if(url.includes('/rest/v1/phonics_bank'))data=mediaRows;
 return route.fulfill({status:200,headers,json:data});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const root='http://127.0.0.1:5226';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:5226,strictPort:true},logLevel:'error'});await server.listen();
const {buildStage1Course,stage1LessonBlocks}=await server.ssrLoadModule('/src/data/phonicsStage1.ts');
const course=buildStage1Course(),unit=course[0];
savedLesson={id:'stage1-qa-saved',academy_id:aid,class_id:null,name:'Stage 1 QA',word_list_id:null,video_url:null,level:null,playlist:stage1LessonBlocks(unit.id),created_by:uid,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),deleted_at:null};
const out='../output/phonics-stage1';
const printOnly=process.env.PHONICS_STAGE1_PRINT_ONLY==='1';
try{
 await page.goto(root+'/materials/phonics-stage-1?view=teacher&unit='+unit.id);await page.locator('.s1-teacher-guide').waitFor();
 await page.getByRole('button',{name:'내 수업에 저장하기',exact:true}).click();await page.getByRole('status').filter({hasText:'수업을 저장했습니다'}).waitFor();
 savedLesson={...savedLesson,...savedPayload};await page.locator('.s1-course-footer a').click();
 const panel=page.locator('h3').filter({hasText:'파닉스 1단계 · 슬라이드와 워크북'}).locator('..');await panel.waitFor();
 assert.equal(await panel.locator('select').nth(0).inputValue(),unit.id);
 await panel.locator('select').nth(0).selectOption('stage1-alphabet-d');await panel.locator('select').nth(1).selectOption('2');
 assert.equal(await panel.locator('select').nth(0).inputValue(),'stage1-alphabet-d');
 await panel.locator('select').nth(0).selectOption(unit.id);await panel.locator('select').nth(1).selectOption('1');
 await page.screenshot({path:out+'/lesson-editor.png',fullPage:true});
 await page.getByRole('button',{name:/이 슬라이드부터 발표$/}).click();await page.locator('.s1-slide').waitFor();
 const first=unit.slides[0].id;assert.equal(await page.locator('.s1-slide').getAttribute('data-stage1-slide'),first);
 await page.setViewportSize({width:1366,height:768});const nav=await page.locator('.s1-slide-navigation').boundingBox();assert(nav.y+nav.height<=768,'runner slide and controls fit a laptop');
 const originalStep=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('classbank.lessonRunner')).stepIndex);
 await page.keyboard.press('PageDown');await page.waitForFunction(id=>document.querySelector('.s1-slide')?.dataset.stage1Slide===id,unit.slides[1].id);
 assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('classbank.lessonRunner')).stepIndex),originalStep);
 await page.keyboard.press('PageUp');await page.waitForFunction(id=>document.querySelector('.s1-slide')?.dataset.stage1Slide===id,first);
 const end=unit.slides.filter(s=>s.lesson===1&&!s.optional).at(-1);await page.locator('.s1-slide-navigation select').selectOption(end.id);await page.waitForFunction(id=>document.querySelector('.s1-slide')?.dataset.stage1Slide===id,end.id);
 await page.locator('[data-s1-next]').click();await page.waitForFunction(id=>document.querySelector('.s1-slide')?.dataset.stage1Slide===id,unit.slides[38].id);
 await page.getByRole('button',{name:'화면 크게 보기',exact:true}).click();await page.screenshot({path:out+'/runner-slide.png'});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'인쇄 워크북',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.s1-book-page').length===8);
 assert.equal(await page.locator('.s1-book-page').nth(2).locator('h2').textContent(),'Read and Match');
 await page.getByRole('button',{name:'교사용 안내·정답',exact:true}).first().click();await page.locator('.s1-teacher-guide').waitFor();
 await page.evaluate(()=>document.fonts.ready);await page.emulateMedia({media:'print'});assert.equal(await page.locator('.no-print:visible').count(),0,'teacher print excludes controls and transient messages');await page.pdf({path:out+'/unit1-teacher-guide.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});
 await page.emulateMedia({media:'screen'});let otherSlides=0;
 for(const u of printOnly?[]:course.slice(1))for(const config of [{lesson:1,optional:false},{lesson:2,optional:false},{lesson:2,optional:true}]){
   await page.goto(root+'/materials/phonics-stage-1?'+new URLSearchParams({unit:u.id,view:'slides',lesson:String(config.lesson),optional:config.optional?'1':'0'}));
   await page.locator('.s1-slide-navigation select').waitFor();
   for(const s of u.slides.filter(s=>config.optional?s.optional:!s.optional&&s.lesson===config.lesson)){
     await page.locator('.s1-slide-navigation select').selectOption(s.id);await page.waitForFunction(id=>document.querySelector('.s1-slide')?.dataset.stage1Slide===id,s.id);
     await page.locator('.s1-slide img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
     assert.equal(await page.locator('.s1-media-error').count(),0,s.id);
     const clipped=await page.locator('.s1-slide-body').evaluate(b=>{const r=b.getBoundingClientRect();return [...b.children].some(c=>c.getBoundingClientRect().bottom>r.bottom+3);});assert(!clipped,s.id);
     otherSlides++;
   }
 }
 assert.equal(otherSlides,printOnly?0:851);
 assert.deepEqual(errors,[]);await writeFile(out+(printOnly?'/integration-print-checks.json':'/integration-checks.json'),JSON.stringify({passed:true,editorUnitAndMode:true,savedReferences:true,runnerRestored:true,clickerKeepsLessonBlock:true,lesson1To2:true,workbookFromRunner:true,otherSlides,errors},null,2));console.log('PASS: lesson editor, runner, clicker, lesson transition, clean print; other slides: '+otherSlides);
}catch(e){await page.screenshot({path:out+'/integration-failure.png',fullPage:true});throw e;}finally{await browser.close();await server.close();}
