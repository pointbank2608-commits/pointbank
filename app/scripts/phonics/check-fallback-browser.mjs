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
await context.route('**/*.supabase.co/**',async route=>{
 const req=route.request(),url=req.url(),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
 if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
 const single=(req.headers().accept??'').includes('vnd.pgrst.object');let data=single?{}:[];
 if(url.includes('/rest/v1/rpc/my_deletion_request'))data=null;else if(url.includes('/auth/v1/user'))data=user;else if(url.includes('/auth/v1/'))data=session;
 else if(url.includes('/rest/v1/profiles'))data=single?profile:[profile];else if(url.includes('/rest/v1/academies'))data=single?academy:[academy];
 else if(url.includes('/rest/v1/phonics_bank'))data=[...observedBank,{id:'old-x-ray',word:'x-ray',pattern_marked:'{x}-ray',step:1,rule:'X',meaning:'엑스레이',image_url:null,sort_order:999}];
 return route.fulfill({status:200,headers,json:data});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
const root=process.env.PHONICS_QA_URL??'http://127.0.0.1:5180';

await mkdir('../output/phonics-fallback',{recursive:true});await mkdir('../tmp/pdfs',{recursive:true});
await page.goto(root+'/materials/phonics-stage-4-workbook');
const print=page.getByRole('button',{name:'선택 유닛 인쇄',exact:true});
await print.waitFor();await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===2);
await page.getByText('48개 유닛 · 105개 학습 항목 · 인쇄 가능한 유닛 48개',{exact:true}).waitFor();
assert.equal(await page.getByRole('checkbox',{disabled:true}).count(),0);
assert.equal(await page.locator('[data-unit-picker] a').count(),0);
assert.equal(await page.locator('[data-unit-picker]').getByText(/컬러 그림 없음|색칠용 선화 없음|준비 중/).count(),0);
assert.equal(await page.locator('[data-asset-status]').getAttribute('open'),null);
const grid=page.locator('[data-unit-picker]');
assert.equal((await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns)).split(' ').length,2);
await page.screenshot({path:'../output/phonics-fallback/desktop.png',fullPage:false});
await page.setViewportSize({width:390,height:850});
assert.equal((await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns)).split(' ').length,1);
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.screenshot({path:'../output/phonics-fallback/mobile.png',fullPage:false});
await page.setViewportSize({width:1440,height:1000});
const reports=[];
for(const [name,words,mode] of [
 ['black',['black','block'],'pictures'],['blank',['blank','blink'],'color-only'],
 ['clam',['clam','clock'],'text'],['glob',['glob','glum'],'text'],['brush',['fish','dish','brush'],'pictures']
]){
 await page.getByRole('button',{name:'선택 지우기',exact:true}).click();
 assert.equal(await page.locator('.print-board').count(),0);assert.equal(await print.isEnabled(),false);
 const checkbox=page.getByRole('checkbox',{name:new RegExp(words.join(' · '))});await checkbox.check();
 await checkbox.focus();assert.equal(await checkbox.evaluate(el=>document.activeElement===el),true);
 assert.notEqual(await checkbox.locator('..').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
 await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===2);
 assert.equal(await print.isEnabled(),true);
 const sheets=page.locator('.print-board');assert.equal(await sheets.locator('section').count(),6);
 for(let i=0;i<6;i++){
  const section=sheets.locator('section').nth(i);
  const exercised=await section.locator('[data-text-word],[data-workbook-word]').evaluateAll(els=>els.map(e=>e.getAttribute('data-text-word')??e.getAttribute('data-workbook-word')));
  if(i!==4||mode==='text')for(const word of words)assert(exercised.includes(word),name+' section '+i+' '+word);
 }
 if(mode==='text'){
  assert.equal(await sheets.locator('img').count(),0);
  const page2=sheets.nth(1);for(const word of words)assert(!(await page2.innerText()).includes(word));
  const letters=await page2.locator('[data-letter-order]').allTextContents();
  assert.deepEqual(letters.map(s=>[...s].sort()),words.map(s=>[...s].sort()));
 }else{
  assert.equal(await sheets.locator('img').count(),mode==='color-only'?words.length*5:words.length*6);
  assert.equal(await sheets.nth(1).locator('section').nth(2).locator('img').count(),mode==='color-only'?0:words.length);
 }
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.print-board img')].map(i=>i.decode()));});
 const imageCount=await sheets.locator('img').count();
 await page.emulateMedia({media:'print'});
 const metrics=await sheets.evaluateAll(els=>els.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,overflow:el.scrollWidth-el.clientWidth})));
 assert(metrics.every(m=>Math.abs(m.width-186*96/25.4)<1&&m.height<1032&&m.overflow<2));
 assert.equal(await page.locator('.no-print').first().isVisible(),false);
 assert(!/자료 준비|컬러 그림 없음|선화 없음|준비 중/.test((await sheets.allTextContents()).join(' ')));
 await page.pdf({path:'../tmp/pdfs/fallback-'+name+'.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});
 await page.screenshot({path:'../output/phonics-fallback/'+name+'-print.png',fullPage:true});
 await page.emulateMedia({media:'screen'});reports.push({name,words,mode,metrics,imageCount});
}
await page.getByRole('button',{name:'전체 선택',exact:true}).click();
await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===96);
assert.equal(await page.getByRole('checkbox',{checked:true}).count(),48);
await page.evaluate(()=>{window.__printCount=0;window.print=()=>window.__printCount++;});
await print.click();assert.equal(await page.evaluate(()=>window.__printCount),1);
await page.goto(root+'/materials/phonics-stage-5-workbook');
await page.getByText('32개 유닛 · 66개 학습 항목 · 인쇄 가능한 유닛 32개',{exact:true}).waitFor();
await page.getByRole('button',{name:'전체 선택',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===64);
assert.equal(await page.getByRole('checkbox',{checked:true}).count(),32);
await page.route('**/phonics-images/black.webp',r=>r.abort());
await page.goto(root+'/materials/phonics-stage-4-workbook');await page.waitForFunction(()=>document.querySelectorAll('.print-board').length===2);
assert.equal(await page.locator('.print-board img').count(),0);assert.equal(await print.isEnabled(),true);
assert.deepEqual(errors,[]);
await writeFile('../output/phonics-fallback/browser-checks.json',JSON.stringify({passed:true,reports,errors,allUnits:[48,32],runtimeBrokenImage:'text fallback',printButton:true},null,2));
await browser.close();console.log('PASS: compact picker, keyboard, all words, fallbacks, A4 previews and print controls.');
